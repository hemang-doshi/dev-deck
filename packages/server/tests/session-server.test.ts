import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";

import { ServiceSession } from "@devdeck/core";

import { createSessionServer } from "../src/create-session-server.js";

describe("createSessionServer", () => {
  const tempDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirectories.map((directory) => rm(directory, { recursive: true, force: true })),
    );
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
          cwd: workspaceDirectory,
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
          cwd: workspaceDirectory,
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
          cwd: workspaceDirectory,
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
});

async function createWorkspace(tempDirectories: string[]): Promise<string> {
  const workspaceDirectory = await mkdtemp(path.join(os.tmpdir(), "devdeck-server-"));
  tempDirectories.push(workspaceDirectory);
  await mkdir(path.join(workspaceDirectory, "assets"), { recursive: true });
  await writeFile(
    path.join(workspaceDirectory, "index.html"),
    "<!doctype html><html><body>DevDeck Test Dashboard</body></html>",
    "utf8",
  );
  return workspaceDirectory;
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
