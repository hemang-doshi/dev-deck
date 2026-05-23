import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { ProcessRunner } from "../src/process-runner.js";
import { ServiceSession } from "../src/service-session.js";

describe("ProcessRunner", () => {
  const tempDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirectories.map((directory) => rm(directory, { recursive: true, force: true })),
    );
    tempDirectories.length = 0;
  });

  it("captures output from a long-running process and stops cleanly", async () => {
    const workspaceDirectory = await createWorkspace(tempDirectories);
    const runner = new ProcessRunner({
      name: "web",
      command:
        "node -e \"console.log('ready'); setInterval(() => console.log('tick'), 25)\"",
      cwd: workspaceDirectory,
    });
    const outputLines: string[] = [];

    runner.subscribe((event) => {
      if (event.type === "output") {
        outputLines.push(event.log.line);
      }
    });

    await runner.start();
    await waitFor(() => outputLines.includes("ready"));
    await runner.stop();

    expect(outputLines).toContain("ready");
  });

  it("records an immediate exit", async () => {
    const workspaceDirectory = await createWorkspace(tempDirectories);
    const runner = new ProcessRunner({
      name: "api",
      command: "node -e \"console.error('boom'); process.exit(2)\"",
      cwd: workspaceDirectory,
    });
    let exitCode: number | null = null;

    runner.subscribe((event) => {
      if (event.type === "exit") {
        exitCode = event.code;
      }
    });

    await runner.start();
    await waitFor(() => exitCode !== null);

    expect(exitCode).toBe(2);
  });

  it("fails when cwd is missing", async () => {
    const runner = new ProcessRunner({
      name: "api",
      command: "node -e \"console.log('hi')\"",
      cwd: path.join(os.tmpdir(), "devdeck-missing-directory"),
    });

    await expect(runner.start()).rejects.toThrow();
  });

  it("tracks restart bookkeeping through the session", async () => {
    const workspaceDirectory = await createWorkspace(tempDirectories);
    const session = new ServiceSession({
      project: "sample",
      services: [
        {
          name: "worker",
          command:
            "node -e \"console.log('boot'); setInterval(() => console.log('pulse'), 30)\"",
          cwd: workspaceDirectory,
        },
      ],
    });

    await session.startAll();
    await waitFor(() => session.getSnapshot().logs.some((log) => log.line === "boot"));
    await session.restartService("worker");
    await waitFor(() => session.getSnapshot().services[0]?.restartCount === 1);
    await session.stopAll();

    expect(session.getSnapshot().services[0]?.restartCount).toBe(1);
  });

  it("surfaces invalid shell commands as non-zero exits", async () => {
    const workspaceDirectory = await createWorkspace(tempDirectories);
    const runner = new ProcessRunner({
      name: "broken",
      command: "this-command-does-not-exist-devdeck",
      cwd: workspaceDirectory,
    });
    let exitCode: number | null = null;

    runner.subscribe((event) => {
      if (event.type === "exit") {
        exitCode = event.code;
      }
    });

    await runner.start();
    await waitFor(() => exitCode !== null);

    expect(exitCode).not.toBe(0);
  });
});

async function createWorkspace(tempDirectories: string[]): Promise<string> {
  const workspaceDirectory = await mkdtemp(path.join(os.tmpdir(), "devdeck-core-"));
  tempDirectories.push(workspaceDirectory);
  await writeFile(path.join(workspaceDirectory, "placeholder.txt"), "ok\n", "utf8");
  return workspaceDirectory;
}

async function waitFor(assertion: () => boolean, timeoutMs: number = 2_000): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    if (assertion()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  throw new Error("Timed out waiting for condition");
}
