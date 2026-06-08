import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { runCli } from "../src/index.js";

const spawnMock = vi.hoisted(() =>
  vi.fn(() => ({
    unref: vi.fn(),
  })),
);

vi.mock("node:child_process", () => ({
  spawn: spawnMock,
}));

describe("agent commands", () => {
  const tempDirectories: string[] = [];
  const servers: Array<{ close: () => Promise<void> }> = [];

  afterEach(async () => {
    await Promise.all(servers.map((server) => server.close()));
    servers.length = 0;
    await Promise.all(
      tempDirectories.map((directory) => rm(directory, { recursive: true, force: true })),
    );
    tempDirectories.length = 0;
  });

  it("prints concise status, logs, and snapshot output from the active session", async () => {
    const workspaceDirectory = await mkdtemp(path.join(os.tmpdir(), "devdeck-agent-cli-"));
    tempDirectories.push(workspaceDirectory);
    const fixture = await createFixtureServer();
    servers.push(fixture);

    await mkdir(path.join(workspaceDirectory, ".devdeck"), { recursive: true });
    await writeFile(
      path.join(workspaceDirectory, ".devdeck", "session.json"),
      JSON.stringify({
        version: 1,
        project: "sample",
        configPath: path.join(workspaceDirectory, "devdeck.yml"),
        url: fixture.url,
        port: fixture.port,
        pid: 1234,
        startedAt: "2026-05-23T00:00:00.000Z",
      }),
      "utf8",
    );

    const status = await runWithCapturedIo(["status"], workspaceDirectory);
    const logs = await runWithCapturedIo(
      ["logs", "api", "--tail", "2", "--severity", "error", "--grep", "db"],
      workspaceDirectory,
    );
    const snapshot = await runWithCapturedIo(["snapshot", "--tail", "2"], workspaceDirectory);

    expect(status.code).toBe(0);
    expect(status.stdout).toContain("Project: sample");
    expect(status.stdout).toContain("api");
    expect(status.stdout).toContain("running");

    expect(logs.code).toBe(0);
    expect(logs.stdout).toContain("db connection lost");
    expect(logs.stdout).not.toContain("boot complete");

    expect(snapshot.code).toBe(0);
    expect(snapshot.stdout).toContain("# Agent DevDeck Snapshot");
    expect(snapshot.stdout).toContain("worker");
    expect(snapshot.stdout).toContain("job failed");
    expect(snapshot.stdout).not.toContain("boot complete");
  });

  it("supports json output and action commands", async () => {
    const workspaceDirectory = await mkdtemp(path.join(os.tmpdir(), "devdeck-agent-cli-"));
    tempDirectories.push(workspaceDirectory);
    const fixture = await createFixtureServer();
    servers.push(fixture);

    const status = await runWithCapturedIo(["status", "--json", "--url", fixture.url], workspaceDirectory);
    const stop = await runWithCapturedIo(["stop", "--url", fixture.url], workspaceDirectory);
    const restart = await runWithCapturedIo(
      ["service", "restart", "api", "--url", fixture.url],
      workspaceDirectory,
    );

    expect(status.code).toBe(0);
    expect(JSON.parse(status.stdout)).toMatchObject({
      schemaVersion: "devdeck.response.v1",
      ok: true,
      command: "status",
      project: "sample",
      result: {
        state: "running",
      },
      error: null,
    });

    expect(stop.code).toBe(0);
    expect(stop.stdout).toContain("stop-session");
    expect(fixture.actions).toContainEqual({ action: "stop-session" });

    expect(restart.code).toBe(0);
    expect(restart.stdout).toContain("restart");
    expect(fixture.actions).toContainEqual({ action: "restart", serviceName: "api" });
  });

  it("wraps snapshot, logs, stop, and service restart json output in the response envelope", async () => {
    const workspaceDirectory = await mkdtemp(path.join(os.tmpdir(), "devdeck-agent-cli-"));
    tempDirectories.push(workspaceDirectory);
    const fixture = await createFixtureServer();
    servers.push(fixture);

    const snapshot = await runWithCapturedIo(["snapshot", "--json", "--url", fixture.url], workspaceDirectory);
    const logs = await runWithCapturedIo(["logs", "--json", "--url", fixture.url], workspaceDirectory);
    const stop = await runWithCapturedIo(["stop", "--json", "--url", fixture.url], workspaceDirectory);
    const restart = await runWithCapturedIo(
      ["service", "restart", "api", "--json", "--url", fixture.url],
      workspaceDirectory,
    );

    for (const result of [snapshot, logs, stop, restart]) {
      expect(result.code).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({
        schemaVersion: "devdeck.response.v1",
        ok: true,
        error: null,
      });
      expect(result.stderr).toBe("");
    }

    expect(JSON.parse(snapshot.stdout)).toMatchObject({ command: "snapshot", project: "sample" });
    expect(JSON.parse(logs.stdout)).toMatchObject({ command: "logs", project: "sample" });
    expect(JSON.parse(stop.stdout)).toMatchObject({ command: "stop" });
    expect(JSON.parse(restart.stdout)).toMatchObject({ command: "service.restart" });
  });

  it("returns json errors without stack traces for expected session failures", async () => {
    const workspaceDirectory = await mkdtemp(path.join(os.tmpdir(), "devdeck-agent-cli-"));
    tempDirectories.push(workspaceDirectory);

    const fetchImplementation = async () => {
      throw new Error("offline");
    };
    const status = await runWithCapturedIo(["status", "--json"], workspaceDirectory, fetchImplementation);
    const stop = await runWithCapturedIo(["stop", "--json"], workspaceDirectory, fetchImplementation);

    expect(status.code).toBe(4);
    expect(JSON.parse(status.stdout)).toMatchObject({
      schemaVersion: "devdeck.response.v1",
      ok: false,
      error: {
        code: "DD_SESSION_API_UNREACHABLE",
        severity: "error",
        retryable: true,
        evidence: [],
      },
    });
    expect(status.stderr).toBe("");
    expect(status.stdout).not.toContain("stack");

    expect(stop.code).toBe(0);
    expect(JSON.parse(stop.stdout)).toMatchObject({
      schemaVersion: "devdeck.response.v1",
      ok: true,
      command: "stop",
      result: {
        state: "not_running",
      },
    });
    expect(stop.stderr).toBe("");
  });

  it("maps json usage errors to stable cli usage responses", async () => {
    const workspaceDirectory = await mkdtemp(path.join(os.tmpdir(), "devdeck-agent-cli-"));
    tempDirectories.push(workspaceDirectory);

    const result = await runWithCapturedIo(["status", "--json", "--bogus"], workspaceDirectory);

    expect(result.code).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
      schemaVersion: "devdeck.response.v1",
      ok: false,
      command: "status",
      error: {
        code: "DD_CLI_USAGE_INVALID",
        severity: "error",
        retryable: false,
        message: "Unknown option: --bogus",
      },
    });
    expect(result.stderr).toBe("");
    expect(result.stdout).not.toContain("stack");
  });

  it("maps invalid logs json severity to stable cli usage responses", async () => {
    const workspaceDirectory = await mkdtemp(path.join(os.tmpdir(), "devdeck-agent-cli-"));
    tempDirectories.push(workspaceDirectory);

    const result = await runWithCapturedIo(["logs", "--json", "--severity", "nope"], workspaceDirectory);

    expect(result.code).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
      schemaVersion: "devdeck.response.v1",
      ok: false,
      command: "logs",
      error: {
        code: "DD_CLI_USAGE_INVALID",
        severity: "error",
        retryable: false,
        message: "Invalid --severity value. Expected info, warning, or error.",
      },
    });
    expect(result.stderr).toBe("");
    expect(result.stdout).not.toContain("stack");
  });

  it("maps invalid logs json tail values to stable cli usage responses", async () => {
    const workspaceDirectory = await mkdtemp(path.join(os.tmpdir(), "devdeck-agent-cli-"));
    tempDirectories.push(workspaceDirectory);

    const result = await runWithCapturedIo(["logs", "--json", "--tail", "10x"], workspaceDirectory);

    expect(result.code).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
      schemaVersion: "devdeck.response.v1",
      ok: false,
      command: "logs",
      error: {
        code: "DD_CLI_USAGE_INVALID",
        severity: "error",
        retryable: false,
        message: "Invalid --tail value. Expected a positive integer.",
      },
    });
    expect(result.stderr).toBe("");
    expect(result.stdout).not.toContain("stack");
  });

  it("maps unknown json commands to stable cli usage responses", async () => {
    const workspaceDirectory = await mkdtemp(path.join(os.tmpdir(), "devdeck-agent-cli-"));
    tempDirectories.push(workspaceDirectory);

    const result = await runWithCapturedIo(["unknown", "--json"], workspaceDirectory);

    expect(result.code).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: false,
      command: "unknown",
      error: {
        code: "DD_CLI_USAGE_INVALID",
        retryable: false,
        message: "Unknown command: unknown",
      },
    });
    expect(result.stderr).toBe("");
  });

  it("reports missing sessions through session inspect json", async () => {
    const workspaceDirectory = await mkdtemp(path.join(os.tmpdir(), "devdeck-agent-cli-"));
    tempDirectories.push(workspaceDirectory);

    const result = await runWithCapturedIo(["session", "inspect", "--json"], workspaceDirectory);

    expect(result.code).toBe(4);
    expect(JSON.parse(result.stdout)).toMatchObject({
      schemaVersion: "devdeck.response.v1",
      ok: false,
      command: "session.inspect",
      error: {
        code: "DD_SESSION_NOT_RUNNING",
        retryable: false,
        evidence: [{ type: "session" }],
      },
    });
    expect(result.stderr).toBe("");
  });

  it("returns json when start finds an already-running session", async () => {
    const workspaceDirectory = await mkdtemp(path.join(os.tmpdir(), "devdeck-agent-cli-"));
    tempDirectories.push(workspaceDirectory);
    await writeSessionFile(workspaceDirectory, {
      pid: process.pid,
      url: "http://127.0.0.1:4545",
    });

    const result = await runWithCapturedIo(["start", "--json"], workspaceDirectory);

    expect(result.code).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      schemaVersion: "devdeck.response.v1",
      ok: false,
      command: "start",
      project: "sample",
      error: {
        code: "DD_SESSION_RUNNING",
        retryable: false,
        evidence: [{ type: "session", pid: process.pid }],
      },
    });
    expect(result.stderr).toBe("");
  });

  it("prints a json timeout envelope when start wait expires", async () => {
    const workspaceDirectory = await mkdtemp(path.join(os.tmpdir(), "devdeck-agent-cli-"));
    tempDirectories.push(workspaceDirectory);
    spawnMock.mockClear();

    const result = await runWithCapturedIo(["start", "--json", "--wait", "0"], workspaceDirectory);

    expect(result.code).toBe(1);
    expect(spawnMock).toHaveBeenCalled();
    expect(JSON.parse(result.stdout)).toMatchObject({
      schemaVersion: "devdeck.response.v1",
      ok: false,
      command: "start",
      error: {
        code: "DD_SESSION_START_TIMEOUT",
        severity: "error",
        retryable: true,
        evidence: [
          { type: "session", path: path.join(workspaceDirectory, ".devdeck", "session.json") },
          { type: "log", service: "devdeck", lines: [path.join(workspaceDirectory, ".devdeck", "devdeck.log")] },
        ],
        nextActions: [
          {
            type: "command",
            command: "devdeck session inspect --json",
          },
        ],
      },
    });
    expect(result.stderr).toBe("");
  });

  it("rejects invalid json start wait values as cli usage errors", async () => {
    const workspaceDirectory = await mkdtemp(path.join(os.tmpdir(), "devdeck-agent-cli-"));
    tempDirectories.push(workspaceDirectory);

    const result = await runWithCapturedIo(["start", "--json", "--wait", "301"], workspaceDirectory);

    expect(result.code).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: false,
      command: "start",
      error: {
        code: "DD_CLI_USAGE_INVALID",
        retryable: false,
        message: "Invalid --wait value. Expected an integer from 0 to 300 seconds.",
      },
    });
    expect(result.stderr).toBe("");
  });

  it("clears stale sessions through session clear-stale json", async () => {
    const workspaceDirectory = await mkdtemp(path.join(os.tmpdir(), "devdeck-agent-cli-"));
    tempDirectories.push(workspaceDirectory);
    await writeSessionFile(workspaceDirectory, {
      pid: 999_999_999,
    });

    const result = await runWithCapturedIo(["session", "clear-stale", "--json"], workspaceDirectory);

    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      schemaVersion: "devdeck.response.v1",
      ok: true,
      command: "session.clear-stale",
      result: {
        cleared: true,
      },
    });
    await expect(
      readFile(path.join(workspaceDirectory, ".devdeck", "session.json"), "utf8"),
    ).rejects.toThrow();
  });

  it("reports missing clear-stale as successful with cleared false", async () => {
    const workspaceDirectory = await mkdtemp(path.join(os.tmpdir(), "devdeck-agent-cli-"));
    tempDirectories.push(workspaceDirectory);

    const result = await runWithCapturedIo(["session", "clear-stale", "--json"], workspaceDirectory);

    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      schemaVersion: "devdeck.response.v1",
      ok: true,
      command: "session.clear-stale",
      result: {
        cleared: false,
      },
    });
    expect(result.stderr).toBe("");
  });

  it("refuses to clear running reachable sessions through session clear-stale json", async () => {
    const workspaceDirectory = await mkdtemp(path.join(os.tmpdir(), "devdeck-agent-cli-"));
    tempDirectories.push(workspaceDirectory);
    const fixture = await createFixtureServer();
    servers.push(fixture);
    await writeSessionFile(workspaceDirectory, {
      pid: process.pid,
      url: fixture.url,
    });

    const result = await runWithCapturedIo(["session", "clear-stale", "--json"], workspaceDirectory);

    expect(result.code).toBe(4);
    expect(JSON.parse(result.stdout)).toMatchObject({
      schemaVersion: "devdeck.response.v1",
      ok: false,
      command: "session.clear-stale",
      project: "sample",
      error: {
        code: "DD_SESSION_RUNNING",
        retryable: false,
        evidence: [{ type: "session", pid: process.pid, url: fixture.url }],
      },
    });
    expect(result.stderr).toBe("");
    await expect(
      readFile(path.join(workspaceDirectory, ".devdeck", "session.json"), "utf8"),
    ).resolves.toContain(fixture.url);
  });

  it("clears unreachable sessions through session clear-stale json", async () => {
    const workspaceDirectory = await mkdtemp(path.join(os.tmpdir(), "devdeck-agent-cli-"));
    tempDirectories.push(workspaceDirectory);
    await writeSessionFile(workspaceDirectory, {
      pid: process.pid,
    });

    const fetchImplementation = async () => new Response("{}", { status: 503 });
    const result = await runWithCapturedIo(["session", "clear-stale", "--json"], workspaceDirectory, fetchImplementation);

    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: true,
      command: "session.clear-stale",
      result: {
        cleared: true,
      },
    });
    await expect(
      readFile(path.join(workspaceDirectory, ".devdeck", "session.json"), "utf8"),
    ).rejects.toThrow();
  });

  it("clears wrong-project sessions through session clear-stale json", async () => {
    const workspaceDirectory = await mkdtemp(path.join(os.tmpdir(), "devdeck-agent-cli-"));
    tempDirectories.push(workspaceDirectory);
    await writeSessionFile(workspaceDirectory, {
      pid: process.pid,
      configPath: path.join(workspaceDirectory, "other", "devdeck.yml"),
    });

    const result = await runWithCapturedIo(["session", "clear-stale", "--json"], workspaceDirectory);

    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: true,
      command: "session.clear-stale",
      result: {
        cleared: true,
      },
    });
    await expect(
      readFile(path.join(workspaceDirectory, ".devdeck", "session.json"), "utf8"),
    ).rejects.toThrow();
  });

  it("prints the agent setup prompt and starter yaml template", async () => {
    const workspaceDirectory = await mkdtemp(path.join(os.tmpdir(), "devdeck-agent-cli-"));
    tempDirectories.push(workspaceDirectory);

    const result = await runWithCapturedIo(["agent", "setup"], workspaceDirectory);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Agent DevDeck");
    expect(result.stdout).toContain("devdeck.yml");
    expect(result.stdout).toContain("services:");
    expect(result.stdout).toContain("Use `devdeck dev`");
  });
});

async function runWithCapturedIo(argv: string[], cwd: string, fetchImplementation?: typeof fetch): Promise<{
  code: number;
  stdout: string;
  stderr: string;
}> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const code = await runCli(argv, {
    cwd,
    fetchImplementation,
    io: {
      stdout: (message) => stdout.push(message),
      stderr: (message) => stderr.push(message),
    },
  });

  return {
    code,
    stdout: stdout.join(""),
    stderr: stderr.join(""),
  };
}

async function writeSessionFile(
  workspaceDirectory: string,
  overrides: Partial<{
    pid: number;
    url: string;
    configPath: string;
  }> = {},
): Promise<void> {
  await mkdir(path.join(workspaceDirectory, ".devdeck"), { recursive: true });
  await writeFile(
    path.join(workspaceDirectory, ".devdeck", "session.json"),
    JSON.stringify({
      version: 1,
      project: "sample",
      configPath: path.join(workspaceDirectory, "devdeck.yml"),
      url: "http://127.0.0.1:4545",
      port: 4545,
      pid: 1234,
      startedAt: "2026-05-23T00:00:00.000Z",
      ...overrides,
    }),
    "utf8",
  );
}

async function createFixtureServer(): Promise<{
  url: string;
  port: number;
  actions: Array<{ action: string; serviceName?: string }>;
  close: () => Promise<void>;
}> {
  const actions: Array<{ action: string; serviceName?: string }> = [];
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");

    if (request.method === "GET" && url.pathname === "/health") {
      respondJson(response, 200, { ok: true });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/snapshot") {
      respondJson(response, 200, createSnapshot());
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/logs") {
      respondJson(response, 200, {
        project: "sample",
        filters: {
          service: url.searchParams.get("service") ?? undefined,
          severity: url.searchParams.get("severity") ?? undefined,
          grep: url.searchParams.get("grep") ?? undefined,
          tail: Number.parseInt(url.searchParams.get("tail") ?? "80", 10),
        },
        totalMatched: 1,
        returned: 1,
        logs: [createSnapshot().logs[1]],
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/actions") {
      const body = await readRequestBody(request);
      const action = JSON.parse(body) as { action: string; serviceName?: string };
      actions.push(action);
      respondJson(response, 200, { ok: true });
      return;
    }

    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Failed to bind fixture server");
  }

  return {
    url: `http://127.0.0.1:${address.port}`,
    port: address.port,
    actions,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      }),
  };
}

function createSnapshot() {
  return {
    project: "sample",
    startedAt: "2026-05-23T00:00:00.000Z",
    services: [
      {
        name: "api",
        command: "npm run api",
        cwd: "/repo/api",
        health: "healthy",
        status: "running",
        pid: 111,
        restartCount: 0,
        lastExitCode: null,
        lastSignal: null,
        lastError: null,
      },
      {
        name: "worker",
        command: "npm run worker",
        cwd: "/repo/worker",
        health: "unknown",
        status: "exited",
        pid: null,
        restartCount: 2,
        lastExitCode: 1,
        lastSignal: null,
        lastError: "job failed",
      },
    ],
    logs: [
      {
        id: 1,
        service: "api",
        line: "boot complete",
        isStackTrace: false,
        ports: [],
        severity: "info",
        stream: "stdout",
        timestamp: "2026-05-23T00:00:01.000Z",
        urls: [],
      },
      {
        id: 2,
        service: "api",
        line: "db connection lost",
        isStackTrace: false,
        ports: [],
        severity: "error",
        stream: "stderr",
        timestamp: "2026-05-23T00:00:02.000Z",
        urls: [],
      },
      {
        id: 3,
        service: "worker",
        line: "job failed",
        isStackTrace: false,
        ports: [],
        severity: "error",
        stream: "stderr",
        timestamp: "2026-05-23T00:00:03.000Z",
        urls: [],
      },
    ],
  };
}

async function readRequestBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf8");
}

function respondJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(body));
}
