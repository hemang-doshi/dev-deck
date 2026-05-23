import { createServer, type Server } from "node:http";

import type { ServiceSession } from "@devdeck/core";

import { handleHttpRequest, type ActionRequest } from "./http-routes.js";
import { startHealthMonitor } from "./health-monitor.js";
import { WebsocketBroker } from "./websocket-broker.js";

export type SessionServerOptions = {
  dashboardAssetsDirectory: string;
  host?: string;
  port?: number;
  session: ServiceSession;
  onStopSession?: () => Promise<void>;
};

export type SessionServer = {
  start: () => Promise<{ url: string; port: number }>;
  stop: () => Promise<void>;
};

export function createSessionServer(options: SessionServerOptions): SessionServer {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 4545;
  const server = createServer((request, response) => {
    void handleHttpRequest(request, response, {
      dashboardAssetsDirectory: options.dashboardAssetsDirectory,
      session: options.session,
      onAction: (action) => handleAction(action),
    });
  });
  const broker = new WebsocketBroker(server, () => options.session.getSnapshot());
  const healthMonitor = startHealthMonitor(options.session);
  const unsubscribe = options.session.subscribe((event) => {
    broker.broadcastEvent(event);
  });

  async function handleAction(action: ActionRequest): Promise<{ ok: boolean; error?: string }> {
    try {
      if (action.action === "start") {
        if (!action.serviceName) {
          throw new Error("Missing serviceName for start action.");
        }

        await options.session.startService(action.serviceName);
      }

      if (action.action === "stop") {
        if (!action.serviceName) {
          throw new Error("Missing serviceName for stop action.");
        }

        await options.session.stopService(action.serviceName);
      }

      if (action.action === "restart") {
        if (!action.serviceName) {
          throw new Error("Missing serviceName for restart action.");
        }

        await options.session.restartService(action.serviceName);
      }

      if (action.action === "stop-session") {
        await options.onStopSession?.();
      }

      broker.broadcastActionResult({
        action: action.action,
        ok: true,
        serviceName: action.serviceName,
      });
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Action failed";
      broker.broadcastActionResult({
        action: action.action,
        ok: false,
        serviceName: action.serviceName,
        error: message,
      });
      return { ok: false, error: message };
    }
  }

  return {
    async start() {
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, host, () => {
          server.off("error", reject);
          resolve();
        });
      });

      const address = server.address();
      const actualPort =
        typeof address === "object" && address !== null ? address.port : port;

      return {
        url: `http://${host}:${actualPort}`,
        port: actualPort,
      };
    },
    async stop() {
      unsubscribe();
      healthMonitor.stop();
      await broker.close();
      await closeServer(server);
    },
  };
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}
