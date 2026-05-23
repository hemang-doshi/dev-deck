import type { Server as HttpServer } from "node:http";

import type { SessionEvent, SessionSnapshot } from "@devdeck/core";
import { WebSocketServer, type WebSocket } from "ws";

export type OutboundMessage =
  | {
      type: "snapshot";
      snapshot: SessionSnapshot;
    }
  | {
      type: "event";
      event: SessionEvent;
    }
  | {
      type: "action-result";
      action: string;
      ok: boolean;
      serviceName?: string;
      error?: string;
    };

export class WebsocketBroker {
  #server: WebSocketServer;
  #clients = new Set<WebSocket>();
  #snapshotProvider: () => SessionSnapshot;

  constructor(server: HttpServer, snapshotProvider: () => SessionSnapshot) {
    this.#snapshotProvider = snapshotProvider;
    this.#server = new WebSocketServer({ server, path: "/ws" });
    this.#server.on("connection", (client: WebSocket) => {
      this.#clients.add(client);
      client.send(
        JSON.stringify({
          type: "snapshot",
          snapshot: this.#snapshotProvider(),
        } satisfies OutboundMessage),
      );

      client.once("close", () => {
        this.#clients.delete(client);
      });
    });
  }

  broadcastEvent(event: SessionEvent): void {
    this.broadcast({
      type: "event",
      event,
    });
  }

  broadcastActionResult(message: Omit<Extract<OutboundMessage, { type: "action-result" }>, "type">): void {
    this.broadcast({
      type: "action-result",
      ...message,
    });
  }

  close(): Promise<void> {
    for (const client of this.#clients) {
      client.close();
    }

    return new Promise((resolve, reject) => {
      this.#server.close((error?: Error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  broadcast(message: OutboundMessage): void {
    const payload = JSON.stringify(message);

    for (const client of this.#clients) {
      client.send(payload);
    }
  }
}
