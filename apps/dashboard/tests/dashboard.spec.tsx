import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders live logs, filters, empty state transitions, and action controls", async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    const performAction = vi.fn().mockResolvedValue(undefined);
    const exportSession = vi.fn().mockResolvedValue("# DevDeck Session Export");
    const client: BrowserSessionClient = {
      connect(handlers) {
        handlers.onConnectionState("connected");
        handlers.onConnectionMeta?.({ hasReceivedSnapshot: true });
        handlers.onSnapshot({
          project: "demo",
          startedAt: "2026-05-23T00:00:00.000Z",
          services: [
            {
              name: "web",
              command: "npm run dev",
              cwd: "/tmp/web",
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
        });
        handlers.onEvent({
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
        return () => undefined;
      },
      exportSession,
      performAction,
    };

    render(<DashboardShell client={client} />);

    expect(screen.getByText("demo")).toBeInTheDocument();
    expect(screen.getByText("ready on http://localhost:3000")).toBeInTheDocument();
    expect(screen.getByText("Error: crashed")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: /api/i })[0]!);
    expect(screen.queryByText("ready on http://localhost:3000")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Error" }));
    expect(screen.getByText("Error: crashed")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Restart" })[0]!);
    fireEvent.click(screen.getByText("Copy debug context"));
    fireEvent.click(screen.getByText("Export session"));

    await waitFor(() => {
      expect(performAction).toHaveBeenCalledWith("restart", "web");
      expect(exportSession).toHaveBeenCalled();
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
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
