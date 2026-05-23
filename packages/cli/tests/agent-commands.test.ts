import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { runCli } from "../src/index.js";

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
    expect(JSON.parse(status.stdout).project).toBe("sample");

    expect(stop.code).toBe(0);
    expect(stop.stdout).toContain("stop-session");
    expect(fixture.actions).toContainEqual({ action: "stop-session" });

    expect(restart.code).toBe(0);
    expect(restart.stdout).toContain("restart");
    expect(fixture.actions).toContainEqual({ action: "restart", serviceName: "api" });
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

async function runWithCapturedIo(argv: string[], cwd: string): Promise<{
  code: number;
  stdout: string;
  stderr: string;
}> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const code = await runCli(argv, {
    cwd,
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

async function createFixtureServer(): Promise<{
  url: string;
  port: number;
  actions: Array<{ action: string; serviceName?: string }>;
  close: () => Promise<void>;
}> {
  const actions: Array<{ action: string; serviceName?: string }> = [];
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");

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
