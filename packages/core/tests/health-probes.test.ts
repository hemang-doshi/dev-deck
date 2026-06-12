import net from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import { checkTcp } from "../src/health-probes.js";

describe("checkTcp", () => {
  const servers = new Set<net.Server>();

  afterEach(async () => {
    await Promise.all(
      [...servers].map(
        (server) =>
          new Promise<void>((resolve, reject) => {
            server.close((error) => {
              if (error) {
                reject(error);
                return;
              }

              resolve();
            });
          }),
      ),
    );
    servers.clear();
  });

  it("treats loopback probes as healthy when the listener is only on IPv6", async () => {
    const server = net.createServer();
    servers.add(server);
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "::1", () => resolve());
    });

    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Expected a TCP address for the test server.");
    }

    await expect(checkTcp("127.0.0.1", address.port, 100)).resolves.toBe(true);
  });

  it("returns false when no loopback listener is reachable", async () => {
    const server = net.createServer();
    servers.add(server);
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => resolve());
    });

    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Expected a TCP address for the test server.");
    }

    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
    servers.delete(server);

    await expect(checkTcp("127.0.0.1", address.port, 100)).resolves.toBe(false);
  });
});
