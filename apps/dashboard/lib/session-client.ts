"use client";

import { startTransition, useEffect, useState } from "react";

import type { LogEvent, ServiceSnapshot, SessionSnapshot } from "@devdeck/core";

export type DashboardService = ServiceSnapshot & { group?: string };
export type DashboardLog = LogEvent;
export type DashboardSnapshot = SessionSnapshot;
export type SeverityFilter = "all" | "info" | "warning" | "error";
export type ConnectionState = "connecting" | "connected" | "reconnecting" | "disconnected";
export type ConnectionMeta = {
  hasReceivedSnapshot: boolean;
  lastConnectedAt: string | null;
  reconnectAttempt: number;
  reconnectScheduledAt: string | null;
};

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
      onConnectionMeta?: (meta: Partial<ConnectionMeta>) => void;
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
      let closingForCleanup = false;
      let reconnectAttempt = 0;

      const connect = () => {
        if (!active) {
          return;
        }

        handlers.onConnectionState(reconnectAttempt > 0 ? "reconnecting" : "connecting");
        socket = new WebSocket(toWebsocketUrl());

        socket.addEventListener("open", () => {
          reconnectAttempt = 0;
          handlers.onConnectionState("connected");
          handlers.onConnectionMeta?.({
            lastConnectedAt: new Date().toISOString(),
            reconnectAttempt: 0,
            reconnectScheduledAt: null,
          });
        });

        socket.addEventListener("message", (event) => {
          const message = JSON.parse(event.data as string) as OutboundState;

          if (message.type === "snapshot") {
            handlers.onConnectionMeta?.({ hasReceivedSnapshot: true });
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
          socket = null;

          if (closingForCleanup || !active) {
            return;
          }

          reconnectAttempt += 1;
          handlers.onConnectionState("reconnecting");
          handlers.onConnectionMeta?.({
            reconnectAttempt,
            reconnectScheduledAt: new Date(Date.now() + 1_000).toISOString(),
          });
          reconnectTimer = setTimeout(connect, 1_000);
        });
      };

      connect();

      return () => {
        active = false;
        closingForCleanup = true;

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
  const [connectionMeta, setConnectionMeta] = useState<ConnectionMeta>({
    hasReceivedSnapshot: false,
    lastConnectedAt: null,
    reconnectAttempt: 0,
    reconnectScheduledAt: null,
  });
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    return client.connect({
      onConnectionState: setConnectionState,
      onConnectionMeta(meta) {
        setConnectionMeta((current) => ({ ...current, ...meta }));
      },
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
    hasReceivedSnapshot: connectionMeta.hasReceivedSnapshot,
    feedback,
    lastConnectedAt: connectionMeta.lastConnectedAt,
    reconnectAttempt: connectionMeta.reconnectAttempt,
    reconnectScheduledAt: connectionMeta.reconnectScheduledAt,
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
