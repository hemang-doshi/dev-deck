import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";

import { ServiceSession } from "@devdeck/core";

import { createSessionServer } from "../src/create-session-server.js";

describe("createSessionServer", () => {
  const tempDirectories: string[] = [];

  afterEach(async () => {
    for (const directory of tempDirectories) {
      await removeWorkspace(directory);
    }
    tempDirectories.length = 0;
  });

  it("sends an initial snapshot on connect and fans out live logs", async () => {
    const workspaceDirectory = await createWorkspace(tempDirectories);
    const session = new ServiceSession({
      project: "sample",
      services: [
        {
          name: "web",
          command:
            "node -e \"console.log('ready'); setInterval(() => console.log('tick'), 100)\"",
          cwd: process.cwd(),
        },
      ],
      maxLogLines: 3,
    });
    const server = createSessionServer({
      dashboardAssetsDirectory: workspaceDirectory,
      session,
      port: 0,
    });
    const { port } = await server.start();

    await session.startAll();

    const messages = await collectMessages(port, 3, async () => {
      await waitFor(() => session.getSnapshot().logs.length > 0);
    });

    expect(messages[0]?.type).toBe("snapshot");
    expect(JSON.stringify(messages)).toContain("\"type\":\"event\"");
    expect(JSON.stringify(messages)).toContain("ready");

    await session.stopAll();
    await server.stop();
  });

  it("returns the current bounded snapshot on reconnect", async () => {
    const workspaceDirectory = await createWorkspace(tempDirectories);
    const session = new ServiceSession({
      project: "sample",
      services: [
        {
          name: "web",
          command:
            "node -e \"let count = 0; const timer = setInterval(() => { console.log('line-' + count); count += 1; if (count === 5) clearInterval(timer); }, 25)\"",
          cwd: process.cwd(),
        },
      ],
      maxLogLines: 2,
    });
    const server = createSessionServer({
      dashboardAssetsDirectory: workspaceDirectory,
      session,
      port: 0,
    });
    const { port } = await server.start();

    await session.startAll();
    await waitFor(() =>
      session.getSnapshot().logs.some((log) => log.line === "line-4"),
    );

    const messages = await collectMessages(port, 1);
    const snapshot = messages[0]?.snapshot;

    expect(snapshot?.logs).toHaveLength(2);
    expect(snapshot?.logs.map((log: { line: string }) => log.line)).toEqual(["line-3", "line-4"]);

    await server.stop();
  });

  it("acknowledges start, stop, restart, and stop-session actions", async () => {
    const workspaceDirectory = await createWorkspace(tempDirectories);
    const session = new ServiceSession({
      project: "sample",
      services: [
        {
          name: "worker",
          command:
            "node -e \"console.log('boot'); setInterval(() => console.log('pulse'), 50)\"",
          cwd: process.cwd(),
        },
      ],
    });
    let stopSessionCalls = 0;
    const server = createSessionServer({
      dashboardAssetsDirectory: workspaceDirectory,
      session,
      port: 0,
      onStopSession: async () => {
        stopSessionCalls += 1;
      },
    });
    const { port } = await server.start();
    const websocket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const messages: any[] = [];

    websocket.on("message", (message) => {
      messages.push(JSON.parse(message.toString("utf8")));
    });

    await waitFor(() => websocket.readyState === WebSocket.OPEN);
    await callAction(port, { action: "start", serviceName: "worker" });
    await waitFor(() => messages.some((message) => message.type === "action-result"));
    await callAction(port, { action: "restart", serviceName: "worker" });
    await callAction(port, { action: "stop", serviceName: "worker" });
    await callAction(port, { action: "stop-session" });

    expect(messages.filter((message) => message.type === "action-result")).toHaveLength(4);
    expect(stopSessionCalls).toBe(1);

    websocket.close();
    await server.stop();
  });

  it("serves dashboard assets and health responses", async () => {
    const workspaceDirectory = await createWorkspace(tempDirectories);
    const session = new ServiceSession({
      project: "sample",
      services: [],
    });
    const server = createSessionServer({
      dashboardAssetsDirectory: workspaceDirectory,
      session,
      port: 0,
    });
    const { port } = await server.start();

    const htmlResponse = await fetch(`http://127.0.0.1:${port}/`);
    const healthResponse = await fetch(`http://127.0.0.1:${port}/health`);
    const exportResponse = await fetch(`http://127.0.0.1:${port}/api/export`);

    expect(await htmlResponse.text()).toContain("DevDeck Test Dashboard");
    expect((await healthResponse.json()).ok).toBe(true);
    expect(await exportResponse.text()).toContain("# DevDeck Session Export");

    await server.stop();
  });

  it("serves snapshot and filtered logs for agent queries", async () => {
    const workspaceDirectory = await createWorkspace(tempDirectories);
    const session = new ServiceSession({
      project: "sample",
      services: [
        {
          name: "api",
          command:
            "node -e \"console.log('boot complete'); console.error('Database ERROR'); console.log('trace user=alice'); setTimeout(() => process.exit(0), 20)\"",
          cwd: process.cwd(),
        },
      ],
      maxLogLines: 10,
    });
    const server = createSessionServer({
      dashboardAssetsDirectory: workspaceDirectory,
      session,
      port: 0,
    });
    const { port } = await server.start();

    await session.startAll();
    await waitFor(() => session.getSnapshot().logs.length >= 3);

    const snapshotResponse = await fetch(`http://127.0.0.1:${port}/api/snapshot`);
    const serviceLogsResponse = await fetch(`http://127.0.0.1:${port}/api/logs?service=api`);
    const errorLogsResponse = await fetch(
      `http://127.0.0.1:${port}/api/logs?severity=error`,
    );
    const grepLogsResponse = await fetch(`http://127.0.0.1:${port}/api/logs?grep=ALICE`);

    const snapshot = await snapshotResponse.json();
    const serviceLogs = await serviceLogsResponse.json();
    const errorLogs = await errorLogsResponse.json();
    const grepLogs = await grepLogsResponse.json();

    expect(snapshot.project).toBe("sample");
    expect(snapshot.logs).toHaveLength(3);
    expect(serviceLogs.totalMatched).toBe(3);
    expect(serviceLogs.returned).toBe(3);
    expect(errorLogs.logs).toHaveLength(1);
    expect(errorLogs.logs[0]?.line).toContain("Database ERROR");
    expect(grepLogs.logs).toHaveLength(1);
    expect(grepLogs.logs[0]?.line).toContain("user=alice");

    await server.stop();
  });

  it("bounds log tails and rejects invalid log query params", async () => {
    const workspaceDirectory = await createWorkspace(tempDirectories);
    const session = new ServiceSession({
      project: "sample",
      services: [
        {
          name: "web",
          command:
            "node -e \"console.log('line-1'); console.log('line-2'); console.log('line-3'); setTimeout(() => process.exit(0), 20)\"",
          cwd: process.cwd(),
        },
      ],
      maxLogLines: 10,
    });
    const server = createSessionServer({
      dashboardAssetsDirectory: workspaceDirectory,
      session,
      port: 0,
    });
    const { port } = await server.start();

    await session.startAll();
    await waitFor(() => session.getSnapshot().logs.length >= 3);

    const tailResponse = await fetch(`http://127.0.0.1:${port}/api/logs?tail=2`);
    const sinceTimestampResponse = await fetch(
      `http://127.0.0.1:${port}/api/logs?since=${encodeURIComponent("2026-01-01T00:00:00.000Z")}`,
    );
    const invalidTailResponse = await fetch(`http://127.0.0.1:${port}/api/logs?tail=0`);

    const tailBody = await tailResponse.json();
    const sinceTimestampBody = await sinceTimestampResponse.json();
    const invalidTailBody = await invalidTailResponse.json();

    expect(tailBody.returned).toBe(2);
    expect(tailBody.logs.map((log: { line: string }) => log.line)).toEqual(["line-2", "line-3"]);
    expect(sinceTimestampBody.logs.map((log: { line: string }) => log.line)).toEqual(["line-1", "line-2", "line-3"]);
    expect(invalidTailResponse.status).toBe(400);
    expect(invalidTailBody.error).toContain("tail");

    await server.stop();
  });

  it("serves canonical v1 events, service logs, and stream messages", async () => {
    const workspaceDirectory = await createWorkspace(tempDirectories);
    const session = new ServiceSession({
      sessionId: "session-v1",
      project: "sample",
      services: [
        {
          name: "api",
          command: "node -e \"console.log('ready'); setTimeout(() => process.exit(0), 20)\"",
          cwd: process.cwd(),
        },
      ],
    });
    const server = createSessionServer({
      dashboardAssetsDirectory: workspaceDirectory,
      session,
      port: 0,
    });
    const { port } = await server.start();
    const websocket = new WebSocket(`ws://127.0.0.1:${port}/api/v1/stream`);
    const streamMessages: any[] = [];

    websocket.on("message", (message) => {
      streamMessages.push(JSON.parse(message.toString("utf8")));
    });

    await waitFor(() => websocket.readyState === WebSocket.OPEN);
    await session.startAll();
    await waitFor(() => session.events.query({ type: "service.log" }).length > 0);

    const eventsResponse = await fetch(`http://127.0.0.1:${port}/api/v1/events?tail=10`);
    const logsResponse = await fetch(`http://127.0.0.1:${port}/api/v1/services/api/logs?tail=5`);
    const sessionResponse = await fetch(`http://127.0.0.1:${port}/api/v1/session`);

    const events = await eventsResponse.json();
    const logs = await logsResponse.json();
    const sessionBody = await sessionResponse.json();

    expect(events.events.some((event: { type: string }) => event.type === "service.log")).toBe(true);
    expect(logs.logs.map((log: { line: string }) => log.line)).toContain("ready");
    expect(sessionBody.sessionId).toBe("session-v1");
    expect(streamMessages.some((message) => message.type === "event" && message.event.type === "service.log")).toBe(true);

    websocket.close();
    await server.stop();
  });
});

async function createWorkspace(tempDirectories: string[]): Promise<string> {
  const workspaceDirectory = path.resolve(process.cwd(), "../../.devdeck/server-tests");
  tempDirectories.push(workspaceDirectory);
  await mkdir(path.join(workspaceDirectory, "assets"), { recursive: true });
  await writeFile(
    path.join(workspaceDirectory, "index.html"),
    "<!doctype html><html><body>DevDeck Test Dashboard</body></html>",
    "utf8",
  );
  return workspaceDirectory;
}

async function removeWorkspace(directory: string): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
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

async function collectMessages(
  port: number,
  expectedCount: number,
  beforeWait?: () => Promise<void>,
): Promise<any[]> {
  const websocket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  const messages: any[] = [];

  websocket.on("message", (message) => {
    messages.push(JSON.parse(message.toString("utf8")));
  });

  await waitFor(() => websocket.readyState === WebSocket.OPEN);

  if (beforeWait) {
    await beforeWait();
  }

  await waitFor(() => messages.length >= expectedCount);
  websocket.close();
  return messages;
}

async function callAction(port: number, body: unknown): Promise<void> {
  const response = await fetch(`http://127.0.0.1:${port}/api/actions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  expect(response.ok).toBe(true);
}

async function waitFor(assertion: () => boolean, timeoutMs: number = 3_000): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    if (assertion()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  throw new Error("Timed out waiting for condition");
}
