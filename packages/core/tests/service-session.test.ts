import { describe, expect, it } from "vitest";

import { ServiceSession } from "../src/service-session.js";

describe("ServiceSession", () => {
  it("does not emit a service event when health is unchanged", () => {
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

    session.subscribe((event) => {
      events.push(event);
    });

    session.setServiceHealth("web", "unknown");

    expect(events).toHaveLength(0);
  });

  it("waits for log readiness before starting dependents", async () => {
    const session = new ServiceSession({
      project: "sample",
      services: [
        {
          name: "db",
          command:
            "node -e \"setTimeout(() => console.log('database ready'), 100); setInterval(() => {}, 1000)\"",
          cwd: process.cwd(),
          readinessProbe: {
            type: "log",
            pattern: "database ready",
          },
        },
        {
          name: "api",
          command: "node -e \"console.log('api booted'); setInterval(() => {}, 1000)\"",
          cwd: process.cwd(),
          dependsOn: {
            db: {
              condition: "ready",
            },
          },
        },
      ],
    });

    await session.startAll();
    await waitFor(() =>
      session.getSnapshot().logs.some((log) => log.service === "api" && log.line === "api booted"),
    );
    const snapshot = session.getSnapshot();
    const dbReadyLog = snapshot.logs.findIndex((log) => log.service === "db" && log.line === "database ready");
    const apiBootLog = snapshot.logs.findIndex((log) => log.service === "api" && log.line === "api booted");

    expect(snapshot.services.find((service) => service.name === "db")?.readiness).toBe("ready");
    expect(dbReadyLog).toBeGreaterThanOrEqual(0);
    expect(apiBootLog).toBeGreaterThan(dbReadyLog);

    await session.stopAll();
  });

  it("does not expose service env values in snapshots", () => {
    const session = new ServiceSession({
      project: "sample",
      services: [
        {
          name: "api",
          command: "node -e \"console.log('ok')\"",
          cwd: process.cwd(),
          env: {
            DATABASE_URL: "postgres://secret",
          },
          envFiles: [".env"],
          requiredEnv: ["DATABASE_URL"],
        },
      ],
    });

    const snapshot = JSON.stringify(session.getSnapshot());

    expect(snapshot).not.toContain("postgres://secret");
    expect(snapshot).not.toContain("\"env\"");
    expect(snapshot).toContain("requiredEnv");
  });

  it("starts dependents on started without waiting for dependency readiness", async () => {
    const session = new ServiceSession({
      project: "sample",
      services: [
        {
          name: "slow",
          command:
            "node -e \"setTimeout(() => console.log('slow ready'), 500); setInterval(() => {}, 1000)\"",
          cwd: process.cwd(),
          readinessProbe: {
            type: "log",
            pattern: "slow ready",
          },
        },
        {
          name: "fast",
          command: "node -e \"console.log('fast booted'); setInterval(() => {}, 1000)\"",
          cwd: process.cwd(),
          dependsOn: {
            slow: {
              condition: "started",
            },
          },
        },
      ],
    });

    const start = session.startAll();
    await waitFor(() =>
      session.getSnapshot().logs.some((log) => log.service === "fast" && log.line === "fast booted"),
    );

    const snapshot = session.getSnapshot();
    const slowReadyLog = snapshot.logs.findIndex((log) => log.service === "slow" && log.line === "slow ready");
    const fastBootLog = snapshot.logs.findIndex((log) => log.service === "fast" && log.line === "fast booted");

    expect(fastBootLog).toBeGreaterThanOrEqual(0);
    if (slowReadyLog !== -1) {
      expect(fastBootLog).toBeLessThan(slowReadyLog);
    }

    await start;
    await session.stopAll();
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
