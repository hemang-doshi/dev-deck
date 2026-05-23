import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DashboardShell } from "../components/dashboard-shell";
import type { BrowserSessionClient } from "../lib/session-client";

describe("DashboardShell", () => {
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

    fireEvent.change(screen.getByLabelText("Filter service"), {
      target: { value: "api" },
    });
    expect(screen.queryByText("ready on http://localhost:3000")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filter severity"), {
      target: { value: "error" },
    });
    expect(screen.getByText("Error: crashed")).toBeInTheDocument();

    fireEvent.click(screen.getAllByText("Restart")[0]!);
    fireEvent.click(screen.getByText("Copy debug context"));
    fireEvent.click(screen.getByText("Export session"));

    await waitFor(() => {
      expect(performAction).toHaveBeenCalledWith("restart", "web");
      expect(exportSession).toHaveBeenCalled();
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });
  });

  it("shows reconnect state when disconnected", () => {
    const client: BrowserSessionClient = {
      connect(handlers) {
        handlers.onConnectionState("disconnected");
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

    render(<DashboardShell client={client} />);

    expect(screen.getByText("Reconnecting")).toBeInTheDocument();
  });
});
