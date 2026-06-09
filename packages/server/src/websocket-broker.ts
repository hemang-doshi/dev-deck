import type { Server as HttpServer } from "node:http";
import type { Duplex } from "node:stream";

import type { DevDeckEvent, SessionEvent, SessionSnapshot } from "@devdeck/core";
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
  #eventServer: WebSocketServer;
  #clients = new Set<WebSocket>();
  #eventClients = new Set<WebSocket>();
  #snapshotProvider: () => SessionSnapshot;

  constructor(server: HttpServer, snapshotProvider: () => SessionSnapshot) {
    this.#snapshotProvider = snapshotProvider;
    this.#server = new WebSocketServer({ noServer: true });
    this.#eventServer = new WebSocketServer({ noServer: true });
    server.on("upgrade", (request, socket, head) => {
      const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;

      if (pathname === "/ws") {
        this.handleUpgrade(this.#server, request, socket, head);
        return;
      }

      if (pathname === "/api/v1/stream") {
        this.handleUpgrade(this.#eventServer, request, socket, head);
        return;
      }

      socket.destroy();
    });
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
    this.#eventServer.on("connection", (client: WebSocket) => {
      this.#eventClients.add(client);
      client.once("close", () => {
        this.#eventClients.delete(client);
      });
    });
  }

  broadcastEvent(event: SessionEvent): void {
    this.broadcast({
      type: "event",
      event,
    });

    if (event.type === "event") {
      this.broadcastCanonicalEvent(event.event);
    }
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
    for (const client of this.#eventClients) {
      client.close();
    }

    return new Promise((resolve, reject) => {
      this.#server.close((error?: Error) => {
        if (error) {
          reject(error);
          return;
        }

        this.#eventServer.close((eventError?: Error) => {
          if (eventError) {
            reject(eventError);
            return;
          }

          resolve();
        });
      });
    });
  }

  broadcast(message: OutboundMessage): void {
    const payload = JSON.stringify(message);

    for (const client of this.#clients) {
      client.send(payload);
    }
  }

  broadcastCanonicalEvent(event: DevDeckEvent): void {
    const payload = JSON.stringify({
      type: "event",
      event,
    });

    for (const client of this.#eventClients) {
      client.send(payload);
    }
  }

  handleUpgrade(
    server: WebSocketServer,
    request: Parameters<WebSocketServer["handleUpgrade"]>[0],
    socket: Duplex,
    head: Buffer,
  ): void {
    server.handleUpgrade(request, socket, head, (client) => {
      server.emit("connection", client, request);
    });
  }
}
