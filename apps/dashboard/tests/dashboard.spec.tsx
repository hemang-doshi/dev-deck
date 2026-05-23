import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DashboardShell } from "../components/dashboard-shell";
import {
  createBrowserSessionClient,
  type BrowserSessionClient,
  type ConnectionState,
} from "../lib/session-client";

describe("DashboardShell", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders the compact workspace, supports tile actions, and keeps debug context copy-only", async () => {
    const clipboardWrite = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: clipboardWrite,
      },
    });

    const performAction = vi.fn().mockResolvedValue(undefined);
    const client = createControllableClient({
      project: "demo",
      startedAt: "2026-05-23T00:00:00.000Z",
      services: [
        {
          name: "web",
          command: "npm run dev",
          cwd: "/tmp/web",
          group: "frontend",
          port: 3000,
          health: "healthy",
          status: "running",
          pid: 10,
          restartCount: 0,
          lastExitCode: null,
          lastSignal: null,
          lastError: null,
        },
        {
          name: "api",
          command: "npm run api",
          cwd: "/tmp/api",
          group: "backend",
          port: 4000,
          health: "unreachable",
          status: "error",
          pid: null,
          restartCount: 1,
          lastExitCode: 1,
          lastSignal: null,
          lastError: "boom",
        },
      ],
      logs: [
        {
          id: 1,
          service: "web",
          line: "ready on http://localhost:3000",
          severity: "info",
          stream: "stdout",
          timestamp: "2026-05-23T00:00:01.000Z",
          urls: ["http://localhost:3000"],
          ports: [3000],
          isStackTrace: false,
        },
        {
          id: 2,
          service: "api",
          line: "Warning: backend degraded",
          severity: "warning",
          stream: "stdout",
          timestamp: "2026-05-23T00:00:02.000Z",
          urls: [],
          ports: [],
          isStackTrace: false,
        },
      ],
    }, performAction);

    render(<DashboardShell client={client.client} />);

    expect(screen.queryByText("Snapshot metadata ready to paste into an issue, prompt, or handoff.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy debug context" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Copy debug context" }));
    await waitFor(() => {
      expect(clipboardWrite).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("button", { name: /webfrontend/i }));
    fireEvent.click(screen.getByRole("button", { name: "Restart" }));
    await waitFor(() => {
      expect(performAction).toHaveBeenCalledWith("restart", "web");
    });

    fireEvent.click(screen.getByText("Add tile"));
    fireEvent.click(screen.getByRole("button", { name: "Add group backend" }));
    fireEvent.click(screen.getByRole("button", { name: "Add service web" }));

    expect(screen.getByTestId("workspace-tile-group:backend")).toBeInTheDocument();
    expect(screen.getByTestId("workspace-tile-service:web")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove Unified stream" })).toBeInTheDocument();

    const backendTile = screen.getByTestId("workspace-tile-group:backend");
    expect(within(backendTile).getByText("Warning: backend degraded")).toBeInTheDocument();
    expect(within(backendTile).queryByText("ready on http://localhost:3000")).not.toBeInTheDocument();

    await act(async () => {
      client.emitEvent({
        type: "event",
        event: {
          type: "log",
          log: {
            id: 3,
            service: "api",
            line: "Error: crashed",
            severity: "error",
            stream: "stderr",
            timestamp: "2026-05-23T00:00:03.000Z",
            urls: [],
            ports: [],
            isStackTrace: false,
          },
        },
      });
    });

    expect(within(backendTile).getByText("Error: crashed")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Recolor web" }));

    await waitFor(() => {
      const storedWorkspace = JSON.parse(localStorage.getItem("devdeck.workspace.demo") ?? "{}");
      expect(storedWorkspace.tiles.find((tile: { id: string }) => tile.id === "service:web")?.color).toBe("amber");
    });
  });

  it("restores persisted tiles on reload for the same project", async () => {
    const clipboardWrite = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: clipboardWrite,
      },
    });

    const client = createControllableClient(buildSnapshot());
    render(<DashboardShell client={client.client} />);

    fireEvent.click(screen.getByText("Add tile"));
    fireEvent.click(screen.getByRole("button", { name: "Add service web" }));
    expect(screen.getByTestId("workspace-tile-service:web")).toBeInTheDocument();

    cleanup();

    render(<DashboardShell client={createControllableClient(buildSnapshot()).client} />);
    expect(screen.getByTestId("workspace-tile-service:web")).toBeInTheDocument();
  });

  it("removes stale persisted tiles when referenced scopes disappear", async () => {
    localStorage.setItem(
      "devdeck.workspace.demo",
      JSON.stringify({
        version: 1,
        tiles: [
          { id: "unified", scopeType: "unified", scopeId: "all", size: "lg", color: "slate", order: 0 },
          { id: "group:backend", scopeType: "group", scopeId: "backend", size: "md", color: "sky", order: 1 },
          { id: "service:web", scopeType: "service", scopeId: "web", size: "sm", color: "mint", order: 2 },
        ],
      }),
    );

    render(
      <DashboardShell
        client={createStaticClient({
          project: "demo",
          startedAt: "2026-05-23T00:00:00.000Z",
          services: [],
          logs: [],
        })}
      />,
    );

    expect(screen.queryByTestId("workspace-tile-group:backend")).not.toBeInTheDocument();
    expect(screen.queryByTestId("workspace-tile-service:web")).not.toBeInTheDocument();

    await waitFor(() => {
      const storedWorkspace = JSON.parse(localStorage.getItem("devdeck.workspace.demo") ?? "{}");
      expect(storedWorkspace.tiles).toEqual([
        { id: "unified", scopeType: "unified", scopeId: "all", size: "lg", color: "slate", order: 0 },
      ]);
    });
  });

  it("does not create a new websocket on snapshot or log updates in the default client path", async () => {
    const webSocket = installFakeWebSocket();

    render(<DashboardShell />);

    expect(webSocket.instances).toHaveLength(1);

    await act(async () => {
      webSocket.instances[0]?.emitOpen();
      webSocket.instances[0]?.emitMessage({
        type: "snapshot",
        snapshot: {
          project: "demo",
          startedAt: "2026-05-23T00:00:00.000Z",
          services: [],
          logs: [],
        },
      });
      webSocket.instances[0]?.emitMessage({
        type: "event",
        event: {
          type: "log",
          log: {
            id: 1,
            service: "web",
            line: "ready",
            severity: "info",
            stream: "stdout",
            timestamp: "2026-05-23T00:00:01.000Z",
            urls: [],
            ports: [],
            isStackTrace: false,
          },
        },
      });
    });

    expect(await screen.findByText("ready")).toBeInTheDocument();
    expect(webSocket.instances).toHaveLength(1);
  });

  it("does not emit disconnected when the browser client is closed during cleanup", () => {
    const webSocket = installFakeWebSocket();
    const states: ConnectionState[] = [];
    const client = createBrowserSessionClient();
    const disconnect = client.connect({
      onConnectionState(state) {
        states.push(state);
      },
      onFeedback() {},
      onSnapshot() {},
      onEvent() {},
    });

    expect(webSocket.instances).toHaveLength(1);

    disconnect();

    expect(states).toEqual(["connecting"]);
    expect(states).not.toContain("disconnected");
  });

  it("shows a reconnect banner and preserves logs after an active socket close", async () => {
    const webSocket = installFakeWebSocket();

    render(<DashboardShell />);

    await act(async () => {
      webSocket.instances[0]?.emitOpen();
      webSocket.instances[0]?.emitMessage({
        type: "snapshot",
        snapshot: {
          project: "demo",
          startedAt: "2026-05-23T00:00:00.000Z",
          services: [],
          logs: [
            {
              id: 1,
              service: "web",
              line: "first log",
              severity: "info",
              stream: "stdout",
              timestamp: "2026-05-23T00:00:01.000Z",
              urls: [],
              ports: [],
              isStackTrace: false,
            },
          ],
        },
      });
      webSocket.instances[0]?.emitClose();
    });

    expect(await screen.findByText("first log")).toBeInTheDocument();
    expect(screen.getByText(/Reconnecting to the local session stream/)).toBeInTheDocument();
    expect(screen.queryByText("No logs yet")).not.toBeInTheDocument();
  });

  it("only shows the no-logs state after a snapshot has been received", async () => {
    const noSnapshotClient: BrowserSessionClient = {
      connect(handlers) {
        handlers.onConnectionState("connected");
        return () => undefined;
      },
      exportSession: async () => "",
      performAction: async () => undefined,
    };

    const snapshotClient: BrowserSessionClient = {
      connect(handlers) {
        handlers.onConnectionState("connected");
        handlers.onConnectionMeta?.({ hasReceivedSnapshot: true });
        handlers.onSnapshot({
          project: "demo",
          startedAt: "2026-05-23T00:00:00.000Z",
          services: [],
          logs: [],
        });
        return () => undefined;
      },
      exportSession: async () => "",
      performAction: async () => undefined,
    };

    render(<DashboardShell client={noSnapshotClient} />);
    expect(screen.queryByText("No logs yet")).not.toBeInTheDocument();

    cleanup();

    render(<DashboardShell client={snapshotClient} />);
    await waitFor(() => {
      expect(screen.getByText("No logs yet")).toBeInTheDocument();
    });
  });
});

function createStaticClient(snapshot: Parameters<typeof createControllableClient>[0]): BrowserSessionClient {
  return createControllableClient(snapshot).client;
}

function createControllableClient(snapshot: {
  project: string;
  startedAt: string;
  services: Array<Record<string, unknown>>;
  logs: Array<Record<string, unknown>>;
}, performAction = vi.fn().mockResolvedValue(undefined)) {
  let handlers:
    | Parameters<BrowserSessionClient["connect"]>[0]
    | null = null;

  return {
    client: {
      connect(nextHandlers) {
        handlers = nextHandlers;
        handlers.onConnectionState("connected");
        handlers.onConnectionMeta?.({ hasReceivedSnapshot: true });
        handlers.onSnapshot(snapshot as never);
        return () => undefined;
      },
      exportSession: async () => "# DevDeck Session Export",
      performAction,
    } satisfies BrowserSessionClient,
    emitEvent(message: Parameters<NonNullable<typeof handlers>["onEvent"]>[0]) {
      handlers?.onEvent(message);
    },
  };
}

function buildSnapshot() {
  return {
    project: "demo",
    startedAt: "2026-05-23T00:00:00.000Z",
    services: [
      {
        name: "web",
        command: "npm run dev",
        cwd: "/tmp/web",
        group: "frontend",
        port: 3000,
        health: "healthy",
        status: "running",
        pid: 10,
        restartCount: 0,
        lastExitCode: null,
        lastSignal: null,
        lastError: null,
      },
    ],
    logs: [
      {
        id: 1,
        service: "web",
        line: "ready on http://localhost:3000",
        severity: "info",
        stream: "stdout",
        timestamp: "2026-05-23T00:00:01.000Z",
        urls: ["http://localhost:3000"],
        ports: [3000],
        isStackTrace: false,
      },
    ],
  };
}

function installFakeWebSocket() {
  const instances: FakeWebSocket[] = [];

  class FakeWebSocket extends EventTarget {
    static OPEN = 1;
    readyState = 0;
    url: string;

    constructor(url: string | URL) {
      super();
      this.url = String(url);
      instances.push(this);
    }

    close() {
      this.readyState = FakeWebSocket.OPEN;
      this.dispatchEvent(new Event("close"));
    }

    emitOpen() {
      this.readyState = FakeWebSocket.OPEN;
      this.dispatchEvent(new Event("open"));
    }

    emitClose() {
      this.dispatchEvent(new Event("close"));
    }

    emitMessage(message: unknown) {
      this.dispatchEvent(
        new MessageEvent("message", {
          data: JSON.stringify(message),
        }),
      );
    }
  }

  vi.stubGlobal("WebSocket", FakeWebSocket as unknown as typeof WebSocket);

  return {
    instances,
  };
}
