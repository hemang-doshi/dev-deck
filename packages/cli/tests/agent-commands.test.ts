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
    expect(snapshot.stdout).toContain("# DevDeck Snapshot");
    expect(snapshot.stdout).toContain("worker");
    expect(snapshot.stdout).toContain("job failed");
    expect(snapshot.stdout).not.toContain("boot complete");
  });

  it("prints compact agent output for status, logs, and snapshot", async () => {
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

    const status = await runWithCapturedIo(["status", "--agent"], workspaceDirectory);
    const logs = await runWithCapturedIo(
      ["logs", "api", "--agent", "--tail", "40", "--severity", "error"],
      workspaceDirectory,
    );
    const snapshot = await runWithCapturedIo(["snapshot", "--agent", "--tail", "10"], workspaceDirectory);

    expect(status.code).toBe(0);
    expect(status.stdout).toContain("STATE degraded");
    expect(status.stdout).toContain("S worker exited ready=failed h=unknown r=2 issue=service_failed");
    expect(status.stdout).not.toContain("/repo/worker");
    expect(status.stdout).not.toContain("npm run worker");

    expect(logs.code).toBe(0);
    expect(logs.stdout).toContain("LOGS api matched=1");
    expect(logs.stdout).toContain('E error api "db connection lost"');
    expect(logs.stdout).not.toContain("2026-05-23");

    expect(snapshot.code).toBe(0);
    expect(snapshot.stdout).toContain("STATE degraded");
    expect(snapshot.stdout).toContain('E error worker "job failed"');
    expect(snapshot.stdout).toContain("NEXT devdeck service restart worker --agent --wait 30 # targeted recovery");
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

  it("supports diagnose --agent with deterministic output", async () => {
    const workspaceDirectory = await mkdtemp(path.join(os.tmpdir(), "devdeck-agent-cli-"));
    tempDirectories.push(workspaceDirectory);
    const fixture = await createFixtureServer({
      snapshotFactory: () => ({
        ...createSnapshot(),
        services: [
          {
            ...createSnapshot().services[0],
            health: "unknown",
            readiness: "failed",
            status: "error",
            pid: null,
            lastError: "startup config error: missing required env SESSION_SECRET",
          },
        ],
        logs: [
          {
            ...createSnapshot().logs[1],
            service: "api",
            severity: "error",
            line: "startup config error: missing required env SESSION_SECRET",
          },
        ],
      }),
    });
    servers.push(fixture);

    const diagnose = await runWithCapturedIo(["diagnose", "--agent", "--url", fixture.url], workspaceDirectory);

    expect(diagnose.code).toBe(4);
    expect(diagnose.stdout).toContain("DIAG degraded root=missing_env svc=api conf=0.95");
    expect(diagnose.stdout).toContain("CAUSE api missing required environment variable SESSION_SECRET");
    expect(diagnose.stdout).toContain("NEXT devdeck stop --agent # cleanup failed startup");
  });

  it("waits for service restart in agent mode and returns compact recovery output", async () => {
    const workspaceDirectory = await mkdtemp(path.join(os.tmpdir(), "devdeck-agent-cli-"));
    tempDirectories.push(workspaceDirectory);
    let restarted = false;
    const failingSnapshot = createSnapshot();
    const healthySnapshot = {
      ...createSnapshot(),
      services: [
        {
          ...createSnapshot().services[0],
          restartCount: 1,
        },
        {
          ...createSnapshot().services[1],
          status: "running",
          readiness: "ready",
          health: "healthy",
          pid: 222,
          restartCount: 1,
          lastExitCode: null,
          lastError: null,
        },
      ],
      logs: [],
    };
    const fixture = await createFixtureServer({
      snapshotFactory: () => (restarted ? healthySnapshot : failingSnapshot),
      onAction: (action) => {
        if (action.action === "restart" && action.serviceName === "api") {
          restarted = true;
        }
      },
    });
    servers.push(fixture);

    const restart = await runWithCapturedIo(
      ["service", "restart", "api", "--agent", "--wait", "1", "--url", fixture.url],
      workspaceDirectory,
    );

    expect(restart.code).toBe(0);
    expect(restart.stdout).toContain("SERVICE restart ok svc=api ready=ready h=healthy");
    expect(restart.stdout).toContain("NEXT devdeck status --agent # verify stack state");
  });

  it("supports start --agent with default wait and start --agent --wait 0", async () => {
    const workspaceDirectory = await mkdtemp(path.join(os.tmpdir(), "devdeck-agent-cli-"));
    tempDirectories.push(workspaceDirectory);
    await writeFile(path.join(workspaceDirectory, "devdeck.yml"), "project: sample\nservices: {}\n", "utf8");
    const fixture = await createFixtureServer({
      snapshotFactory: () => ({
        ...createSnapshot(),
        services: [
          {
            ...createSnapshot().services[0],
          },
        ],
        logs: [],
      }),
    });
    servers.push(fixture);

    spawnMock.mockImplementationOnce(() => {
      setTimeout(() => {
        void writeSessionFile(workspaceDirectory, {
          pid: process.pid,
          url: fixture.url,
        });
      }, 10);
      return { unref: vi.fn() };
    });

    const waited = await runWithCapturedIo(["start", "--agent", "--wait"], workspaceDirectory);
    expect(waited.code).toBe(0);
    expect(waited.stdout).toContain("START ok project=sample");
    expect(waited.stdout).toContain("STATE running svc=1 fail=0 bad=0 warn=0 err=0");

    await rm(path.join(workspaceDirectory, ".devdeck"), { recursive: true, force: true });
    spawnMock.mockImplementationOnce(() => {
      setTimeout(() => {
        void writeSessionFile(workspaceDirectory, {
          pid: process.pid,
          url: fixture.url,
        });
      }, 10);
      return { unref: vi.fn() };
    });

    const noWait = await runWithCapturedIo(["start", "--agent", "--wait", "0"], workspaceDirectory);
    expect(noWait.code).toBe(0);
    expect(noWait.stdout).toContain("START ok project=sample");
  });

  it("prints clean JSONL events from the active session", async () => {
    const workspaceDirectory = await mkdtemp(path.join(os.tmpdir(), "devdeck-agent-cli-"));
    tempDirectories.push(workspaceDirectory);
    const fixture = await createFixtureServer();
    servers.push(fixture);

    const events = await runWithCapturedIo(
      ["events", "--jsonl", "--tail", "2", "--url", fixture.url],
      workspaceDirectory,
    );

    expect(events.code).toBe(0);
    expect(events.stderr).toBe("");
    const lines = events.stdout.trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(lines.map((line) => JSON.parse(line).schemaVersion)).toEqual([
      "devdeck.event.v1",
      "devdeck.event.v1",
    ]);
    expect(events.stdout).not.toContain("schemaVersion\":\"devdeck.response.v1");
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

  it("rejects invalid agent flag combinations", async () => {
    const workspaceDirectory = await mkdtemp(path.join(os.tmpdir(), "devdeck-agent-cli-"));
    tempDirectories.push(workspaceDirectory);

    const status = await runWithCapturedIo(["status", "--json", "--agent"], workspaceDirectory);
    const logs = await runWithCapturedIo(["logs", "--agent", "--stream", "--jsonl"], workspaceDirectory);

    expect(status.code).toBe(2);
    expect(JSON.parse(status.stdout)).toMatchObject({
      command: "status",
      error: {
        code: "DD_CLI_USAGE_INVALID",
        message: "Cannot combine --json and --agent.",
      },
    });
    expect(status.stderr).toBe("");

    expect(logs.code).toBe(2);
    expect(logs.stderr).toContain("Cannot combine --agent with --stream or --jsonl.");
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

  it("rejects invalid wait values for start and service commands", async () => {
    const workspaceDirectory = await mkdtemp(path.join(os.tmpdir(), "devdeck-agent-cli-"));
    tempDirectories.push(workspaceDirectory);

    const start = await runWithCapturedIo(["start", "--json", "--wait", "-1"], workspaceDirectory);
    const service = await runWithCapturedIo(["service", "restart", "api", "--json", "--wait", "10x"], workspaceDirectory);

    expect(start.code).toBe(2);
    expect(JSON.parse(start.stdout)).toMatchObject({
      command: "start",
      error: {
        code: "DD_CLI_USAGE_INVALID",
        message: "Invalid --wait value. Expected an integer from 0 to 300 seconds.",
      },
    });

    expect(service.code).toBe(2);
    expect(JSON.parse(service.stdout)).toMatchObject({
      command: "service",
      error: {
        code: "DD_CLI_USAGE_INVALID",
        message: "Invalid --wait value. Expected an integer from 0 to 300 seconds.",
      },
    });
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
    const fixture = await createFixtureServer();
    servers.push(fixture);
    await writeSessionFile(workspaceDirectory, {
      pid: process.pid,
      url: fixture.url,
      configPath: path.join(workspaceDirectory, "devdeck.yml"),
    });
    await writeFile(
      path.join(workspaceDirectory, "devdeck.yml"),
      ["project: sample", "services:", "  api:", "    command: npm run api", "    cwd: ."].join("\n"),
      "utf8",
    );

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
    expect(result.stdout).toContain("DevDeck");
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

async function createFixtureServer(options: {
  snapshotFactory?: () => ReturnType<typeof createSnapshot>;
  onAction?: (action: { action: string; serviceName?: string }) => void;
} = {}): Promise<{
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
      respondJson(response, 200, (options.snapshotFactory ?? createSnapshot)());
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
        logs: [(options.snapshotFactory ?? createSnapshot)().logs[1]],
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/events") {
      respondJson(response, 200, {
        project: "sample",
        sessionId: "session-fixture",
        eventCursor: "evt_000003",
        returned: 2,
        events: [
          {
            schemaVersion: "devdeck.event.v1",
            id: "evt_000002",
            sessionId: "session-fixture",
            project: "sample",
            timestamp: "2026-05-23T00:00:02.000Z",
            observedTimestamp: "2026-05-23T00:00:02.000Z",
            type: "service.log",
            service: "api",
            stream: "stderr",
            severityText: "ERROR",
            severityNumber: 17,
            body: "db connection lost",
          },
          {
            schemaVersion: "devdeck.event.v1",
            id: "evt_000003",
            sessionId: "session-fixture",
            project: "sample",
            timestamp: "2026-05-23T00:00:03.000Z",
            observedTimestamp: "2026-05-23T00:00:03.000Z",
            type: "service.exited",
            service: "worker",
          },
        ],
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/actions") {
      const body = await readRequestBody(request);
      const action = JSON.parse(body) as { action: string; serviceName?: string };
      actions.push(action);
      options.onAction?.(action);
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
        readiness: "ready",
        status: "running",
        pid: 111,
        restartCount: 0,
        blockedBy: [],
        lastReadyAt: "2026-05-23T00:00:01.000Z",
        lastHealthCheckAt: "2026-05-23T00:00:02.000Z",
        lastExitCode: null,
        lastSignal: null,
        lastError: null,
      },
      {
        name: "worker",
        command: "npm run worker",
        cwd: "/repo/worker",
        health: "unknown",
        readiness: "failed",
        status: "exited",
        pid: null,
        restartCount: 2,
        blockedBy: [],
        lastReadyAt: null,
        lastHealthCheckAt: null,
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
