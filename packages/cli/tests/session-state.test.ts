import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  clearSessionState,
  readSessionState,
  resolveSessionBaseUrl,
  writeSessionState,
} from "../src/session-state.js";

describe("session-state", () => {
  const tempDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirectories.map((directory) => rm(directory, { recursive: true, force: true })),
    );
    tempDirectories.length = 0;
  });

  it("writes and reads the runtime session file", async () => {
    const workspaceDirectory = await mkdtemp(path.join(os.tmpdir(), "devdeck-session-state-"));
    tempDirectories.push(workspaceDirectory);

    await writeSessionState({
      cwd: workspaceDirectory,
      session: {
        version: 1,
        project: "sample",
        configPath: path.join(workspaceDirectory, "devdeck.yml"),
        url: "http://127.0.0.1:4545",
        port: 4545,
        pid: 1234,
        startedAt: "2026-05-23T00:00:00.000Z",
      },
    });

    await expect(readSessionState(workspaceDirectory)).resolves.toEqual({
      version: 1,
      project: "sample",
      configPath: path.join(workspaceDirectory, "devdeck.yml"),
      url: "http://127.0.0.1:4545",
      port: 4545,
      pid: 1234,
      startedAt: "2026-05-23T00:00:00.000Z",
    });

    const raw = await readFile(path.join(workspaceDirectory, ".devdeck/session.json"), "utf8");
    expect(JSON.parse(raw).url).toBe("http://127.0.0.1:4545");
  });

  it("prefers explicit url, then runtime file, then the default local url", async () => {
    const workspaceDirectory = await mkdtemp(path.join(os.tmpdir(), "devdeck-session-state-"));
    tempDirectories.push(workspaceDirectory);
    await mkdir(path.join(workspaceDirectory, ".devdeck"), { recursive: true });

    await writeSessionState({
      cwd: workspaceDirectory,
      session: {
        version: 1,
        project: "sample",
        configPath: path.join(workspaceDirectory, "devdeck.yml"),
        url: "http://127.0.0.1:8787",
        port: 8787,
        pid: 4321,
        startedAt: "2026-05-23T00:00:00.000Z",
      },
    });

    await expect(
      resolveSessionBaseUrl({
        cwd: workspaceDirectory,
        url: "http://127.0.0.1:9999",
      }),
    ).resolves.toBe("http://127.0.0.1:9999");
    await expect(resolveSessionBaseUrl({ cwd: workspaceDirectory })).resolves.toBe(
      "http://127.0.0.1:8787",
    );

    await clearSessionState(workspaceDirectory);

    await expect(resolveSessionBaseUrl({ cwd: workspaceDirectory })).resolves.toBe(
      "http://127.0.0.1:4545",
    );
  });
});
