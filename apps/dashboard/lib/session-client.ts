"use client";

import { startTransition, useEffect, useState } from "react";

import type { LogEvent, ServiceSnapshot, SessionSnapshot } from "@devdeck/core";

export type DashboardService = ServiceSnapshot;
export type DashboardLog = LogEvent;
export type DashboardSnapshot = SessionSnapshot;
export type SeverityFilter = "all" | "info" | "warning" | "error";
export type ConnectionState = "connecting" | "connected" | "disconnected";

type OutboundState =
  | {
      type: "snapshot";
      snapshot: DashboardSnapshot;
    }
  | {
      type: "event";
      event:
        | { type: "service"; service: DashboardService }
        | { type: "log"; log: DashboardLog };
    }
  | {
      type: "action-result";
      action: string;
      ok: boolean;
      serviceName?: string;
      error?: string;
    };

export type BrowserSessionClient = {
  connect: (
    handlers: {
      onConnectionState: (state: ConnectionState) => void;
      onFeedback: (message: string | null) => void;
      onSnapshot: (snapshot: DashboardSnapshot) => void;
      onEvent: (message: OutboundState) => void;
    },
  ) => () => void;
  exportSession: () => Promise<string>;
  performAction: (action: string, serviceName?: string) => Promise<void>;
};

const EMPTY_SNAPSHOT: DashboardSnapshot = {
  project: "",
  startedAt: "",
  services: [],
  logs: [],
};

export function createBrowserSessionClient(): BrowserSessionClient {
  return {
    connect(handlers) {
      let active = true;
      let socket: WebSocket | null = null;
      let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

      const connect = () => {
        handlers.onConnectionState(socket ? "connecting" : "connecting");
        socket = new WebSocket(toWebsocketUrl());

        socket.addEventListener("open", () => {
          handlers.onConnectionState("connected");
        });

        socket.addEventListener("message", (event) => {
          const message = JSON.parse(event.data as string) as OutboundState;

          if (message.type === "snapshot") {
            handlers.onSnapshot(message.snapshot);
            return;
          }

          if (message.type === "action-result") {
            handlers.onFeedback(
              message.ok
                ? `${message.action}${message.serviceName ? ` ${message.serviceName}` : ""} complete`
                : message.error ?? "Action failed",
            );
          }

          handlers.onEvent(message);
        });

        socket.addEventListener("close", () => {
          handlers.onConnectionState("disconnected");

          if (active) {
            reconnectTimer = setTimeout(connect, 1_000);
          }
        });
      };

      connect();

      return () => {
        active = false;

        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
        }

        socket?.close();
      };
    },
    async exportSession() {
      const response = await fetch("/api/export");
      return response.text();
    },
    async performAction(action, serviceName) {
      await fetch("/api/actions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ action, serviceName }),
      });
    },
  };
}

export function useSessionClient(client: BrowserSessionClient) {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>(EMPTY_SNAPSHOT);
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    return client.connect({
      onConnectionState: setConnectionState,
      onFeedback: setFeedback,
      onSnapshot(nextSnapshot) {
        startTransition(() => {
          setSnapshot(nextSnapshot);
        });
      },
      onEvent(message) {
        if (message.type !== "event") {
          return;
        }

        startTransition(() => {
          setSnapshot((current) => reduceSnapshot(current, message));
        });
      },
    });
  }, [client]);

  return {
    connectionState,
    feedback,
    snapshot,
    async copyText(value: string, successMessage: string) {
      await navigator.clipboard.writeText(value);
      setFeedback(successMessage);
    },
    async exportSession() {
      const contents = await client.exportSession();
      await navigator.clipboard.writeText(contents);
      setFeedback("Session export copied");
    },
    async performAction(action: string, serviceName?: string) {
      await client.performAction(action, serviceName);
    },
  };
}

function reduceSnapshot(current: DashboardSnapshot, message: Extract<OutboundState, { type: "event" }>) {
  const event = message.event;

  if (event.type === "service") {
    return {
      ...current,
      services: current.services.map((service) =>
        service.name === event.service.name ? event.service : service,
      ),
    };
  }

  return {
    ...current,
    logs: [...current.logs, event.log].slice(-500),
  };
}

function toWebsocketUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
}
