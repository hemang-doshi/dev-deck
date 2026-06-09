import { rm } from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { ProcessRunner } from "../src/process-runner.js";
import { ServiceSession } from "../src/service-session.js";

describe("ProcessRunner", () => {
  const tempDirectories: string[] = [];

  afterEach(async () => {
    for (const directory of tempDirectories) {
      await removeWorkspace(directory);
    }
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
      cwd: path.join(testTempRoot(), "devdeck-missing-directory"),
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

  it("runs exec.argv without shell and merges service env", async () => {
    const workspaceDirectory = await createWorkspace(tempDirectories);
    const runner = new ProcessRunner({
      name: "exec",
      exec: {
        argv: [process.execPath, "-e", "console.log(process.env.DD_EXEC_TEST)"],
      },
      cwd: workspaceDirectory,
      env: {
        DD_EXEC_TEST: "from-env",
      },
    });
    const outputLines: string[] = [];

    runner.subscribe((event) => {
      if (event.type === "output") {
        outputLines.push(event.log.line);
      }
    });

    await runner.start();
    await waitFor(() => outputLines.includes("from-env"));

    expect(outputLines).toContain("from-env");
  });

  it("restarts failed processes up to maxRestarts", async () => {
    const workspaceDirectory = await createWorkspace(tempDirectories);
    const runner = new ProcessRunner({
      name: "flaky",
      command: "node -e \"process.exit(1)\"",
      cwd: workspaceDirectory,
      restartPolicy: {
        mode: "on-failure",
        maxRestarts: 2,
        delayMs: 10,
      },
    });

    await runner.start();
    await waitFor(() => runner.restartCount === 2);
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(runner.restartCount).toBe(2);
  });

  it("runs npm through exec.argv without explicit shell config", async () => {
    const runner = new ProcessRunner({
      name: "npm",
      exec: {
        argv: ["npm", "--version"],
      },
      cwd: process.cwd(),
    });
    const outputLines: string[] = [];

    runner.subscribe((event) => {
      if (event.type === "output") {
        outputLines.push(event.log.line);
      }
    });

    await runner.start();
    await waitFor(() => outputLines.length > 0);

    expect(outputLines.join("\n")).toMatch(/\d+\.\d+\.\d+/);
  });
});

async function createWorkspace(tempDirectories: string[]): Promise<string> {
  void tempDirectories;
  return process.cwd();
}

function testTempRoot(): string {
  return path.resolve(process.cwd(), "../../.devdeck/core-tests");
}

async function removeWorkspace(directory: string): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      await rm(directory, { recursive: true, force: true });
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;

      if (code !== "EBUSY" && code !== "ENOTEMPTY" && code !== "EPERM") {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  await rm(directory, { recursive: true, force: true });
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
