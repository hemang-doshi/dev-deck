import net from "node:net";

import { afterEach, describe, expect, it, vi } from "vitest";

import { ServiceSession } from "@devdeck/core";

import { startHealthMonitor } from "../src/health-monitor.js";

describe("startHealthMonitor", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not fan out unchanged health updates while polling", async () => {
    vi.useFakeTimers();

    const session = new ServiceSession({
      project: "sample",
      services: [
        {
          name: "web",
          command: "npm run dev",
          cwd: "/tmp/web",
        },
      ],
    });
    const events: Array<{ type: string }> = [];
    const unsubscribe = session.subscribe((event) => {
      events.push(event);
    });

    const monitor = startHealthMonitor(session);
    await vi.advanceTimersByTimeAsync(2_100);

    monitor.stop();
    unsubscribe();

    expect(events).toHaveLength(0);
  });

  it("treats an IPv6 loopback listener as healthy", async () => {
    const server = net.createServer();
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "::1", () => resolve());
    });

    const address = server.address();
    if (!address || typeof address === "string") {
      server.close();
      throw new Error("Expected an IPv6 TCP server address.");
    }

    const session = new ServiceSession({
      project: "sample",
      services: [
        {
          name: "web",
          command: "node -e \"setInterval(() => {}, 1_000)\"",
          cwd: "/tmp",
          port: address.port,
          healthProbe: {
            type: "tcp",
            host: "127.0.0.1",
            port: address.port,
          },
        },
      ],
    });

    await session.startAll();
    const monitor = startHealthMonitor(session);

    let observedHealth: string | undefined;

    try {
      await waitFor(() => session.getSnapshot().services[0]?.health === "healthy");
      observedHealth = session.getSnapshot().services[0]?.health;
    } finally {
      monitor.stop();
      await session.stopAll();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }

    expect(observedHealth).toBe("healthy");
  });
});

async function waitFor(assertion: () => boolean, timeoutMs: number = 2_000): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    if (assertion()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  throw new Error("Timed out waiting for condition");
}
