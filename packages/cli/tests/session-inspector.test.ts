import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { clearStaleSession, inspectSession } from "../src/session-inspector.js";
import { readSessionState, writeSessionState, type RuntimeSessionState } from "../src/session-state.js";

describe("session-inspector", () => {
  const tempDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirectories.map((directory) => rm(directory, { recursive: true, force: true })),
    );
    tempDirectories.length = 0;
  });

  it("reports missing when the session file does not exist", async () => {
    const workspaceDirectory = await createWorkspaceDirectory();

    await expect(inspectSession({ cwd: workspaceDirectory })).resolves.toMatchObject({
      state: "missing",
      cwd: workspaceDirectory,
      sessionPath: path.join(workspaceDirectory, ".devdeck/session.json"),
    });
  });

  it("reports stale when the session pid is not alive", async () => {
    const workspaceDirectory = await createWorkspaceDirectory();
    await writeSessionState({
      cwd: workspaceDirectory,
      session: createSession(workspaceDirectory, {
        pid: 999_999_999,
      }),
    });

    await expect(inspectSession({ cwd: workspaceDirectory })).resolves.toMatchObject({
      state: "stale",
      reason: "pid_not_alive",
    });
  });

  it("reports running when the pid is alive and the session url is reachable", async () => {
    const workspaceDirectory = await createWorkspaceDirectory();
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(new Response("{}", { status: 200 }));
    await writeSessionState({
      cwd: workspaceDirectory,
      session: createSession(workspaceDirectory, {
        pid: process.pid,
      }),
    });

    const inspection = await inspectSession({
      cwd: workspaceDirectory,
      fetchImplementation,
    });

    expect(inspection).toMatchObject({
      state: "running",
      session: {
        pid: process.pid,
      },
    });
    expect(fetchImplementation).toHaveBeenCalledWith(new URL("http://127.0.0.1:4545/health"));
  });

  it("uses the discovered project config when inspecting from a subdirectory", async () => {
    const workspaceDirectory = await createWorkspaceDirectory();
    const nestedDirectory = path.join(workspaceDirectory, "apps", "web");
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(new Response("{}", { status: 200 }));

    await mkdir(nestedDirectory, { recursive: true });
    await writeFile(
      path.join(workspaceDirectory, "devdeck.yml"),
      ["project: sample", "services:", "  web:", "    command: npm run dev", "    cwd: ."].join("\n"),
      "utf8",
    );
    await writeSessionState({
      cwd: workspaceDirectory,
      session: createSession(workspaceDirectory, {
        pid: process.pid,
      }),
    });

    await expect(
      inspectSession({
        cwd: nestedDirectory,
        fetchImplementation,
      }),
    ).resolves.toMatchObject({
      state: "running",
      cwd: nestedDirectory,
      sessionPath: path.join(workspaceDirectory, ".devdeck", "session.json"),
      session: {
        configPath: path.join(workspaceDirectory, "devdeck.yml"),
      },
    });
  });

  it("reports wrong_project when the saved config path differs from the current project config", async () => {
    const workspaceDirectory = await createWorkspaceDirectory();
    const otherDirectory = await createWorkspaceDirectory();

    await writeFile(
      path.join(workspaceDirectory, "devdeck.yml"),
      ["project: sample", "services:", "  web:", "    command: npm run dev", "    cwd: ."].join("\n"),
      "utf8",
    );
    await writeSessionState({
      cwd: workspaceDirectory,
      session: createSession(workspaceDirectory, {
        configPath: path.join(otherDirectory, "devdeck.yml"),
      }),
    });

    await expect(inspectSession({ cwd: workspaceDirectory })).resolves.toMatchObject({
      state: "wrong_project",
      expectedProjectRoot: workspaceDirectory,
      actualProjectRoot: otherDirectory,
    });
  });

  it("does not clear a running session", async () => {
    const workspaceDirectory = await createWorkspaceDirectory();
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(new Response("{}", { status: 200 }));
    await writeSessionState({
      cwd: workspaceDirectory,
      session: createSession(workspaceDirectory, {
        pid: process.pid,
      }),
    });

    await expect(
      clearStaleSession({
        inspection: await inspectSession({
          cwd: workspaceDirectory,
          fetchImplementation,
        }),
      }),
    ).resolves.toBe(false);
    await expect(readSessionState(workspaceDirectory)).resolves.toMatchObject({
      pid: process.pid,
    });
  });

  async function createWorkspaceDirectory(): Promise<string> {
    const workspaceDirectory = await mkdtemp(path.join(os.tmpdir(), "devdeck-session-inspector-"));
    tempDirectories.push(workspaceDirectory);
    return workspaceDirectory;
  }
});

function createSession(
  workspaceDirectory: string,
  overrides: Partial<RuntimeSessionState> = {},
): RuntimeSessionState {
  return {
    version: 1,
    project: "sample",
    configPath: path.join(workspaceDirectory, "devdeck.yml"),
    url: "http://127.0.0.1:4545",
    port: 4545,
    pid: 1234,
    startedAt: "2026-05-23T00:00:00.000Z",
    ...overrides,
  };
}
