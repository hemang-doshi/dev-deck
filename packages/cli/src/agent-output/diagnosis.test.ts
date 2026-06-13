import type { SessionSnapshot } from "@devdeck/core";
import { describe, expect, it } from "vitest";

import { diagnoseSnapshot } from "./diagnosis.js";

function createBaseSnapshot(): SessionSnapshot {
  return {
    sessionId: "session-1",
    project: "sample",
    startedAt: "2026-05-23T00:00:00.000Z",
    eventCursor: "cursor-1",
    services: [],
    logs: [],
  };
}

describe("diagnoseSnapshot", () => {
  it("classifies missing env failures", () => {
    const diagnosis = diagnoseSnapshot({
      ...createBaseSnapshot(),
      services: [
        {
          name: "api",
          command: "npm run api",
          cwd: "/repo/api",
          health: "unknown",
          readiness: "failed",
          status: "error",
          pid: null,
          restartCount: 0,
          blockedBy: [],
          lastReadyAt: null,
          lastHealthCheckAt: null,
          lastExitCode: 1,
          lastSignal: null,
          lastError: "startup config error: missing required env SESSION_SECRET",
        },
      ],
      logs: [],
    });

    expect(diagnosis.root).toBe("missing_env");
    expect(diagnosis.nextAction.command).toBe("devdeck stop --agent");
  });

  it("classifies port conflicts", () => {
    const diagnosis = diagnoseSnapshot({
      ...createBaseSnapshot(),
      services: [
        {
          name: "api",
          command: "npm run api",
          cwd: "/repo/api",
          health: "unknown",
          readiness: "failed",
          status: "error",
          pid: null,
          restartCount: 0,
          blockedBy: [],
          lastReadyAt: null,
          lastHealthCheckAt: null,
          lastExitCode: 1,
          lastSignal: null,
          lastError: "EADDRINUSE: address already in use :::4000",
        },
      ],
      logs: [],
    });

    expect(diagnosis.root).toBe("port_conflict");
    expect(diagnosis.cause).toContain("already in use");
  });

  it("classifies service crashes for targeted restart", () => {
    const diagnosis = diagnoseSnapshot({
      ...createBaseSnapshot(),
      services: [
        {
          name: "api",
          command: "npm run api",
          cwd: "/repo/api",
          health: "unknown",
          readiness: "failed",
          status: "exited",
          pid: null,
          restartCount: 1,
          blockedBy: [],
          lastReadyAt: null,
          lastHealthCheckAt: null,
          lastExitCode: 1,
          lastSignal: null,
          lastError: "simulated crash after startup",
        },
      ],
      logs: [],
    });

    expect(diagnosis.root).toBe("service_crash");
    expect(diagnosis.nextAction.command).toBe("devdeck service restart api --agent --wait 30");
  });

  it("classifies warning logs", () => {
    const diagnosis = diagnoseSnapshot({
      ...createBaseSnapshot(),
      services: [
        {
          name: "worker",
          command: "npm run worker",
          cwd: "/repo/worker",
          health: "healthy",
          readiness: "ready",
          status: "running",
          pid: 321,
          restartCount: 0,
          blockedBy: [],
          lastReadyAt: null,
          lastHealthCheckAt: null,
          lastExitCode: null,
          lastSignal: null,
          lastError: null,
        },
      ],
      logs: [
        {
          id: 1,
          service: "worker",
          line: "queue latency above threshold",
          isStackTrace: false,
          ports: [],
          severity: "warning",
          stream: "stderr",
          timestamp: "2026-05-23T00:00:01.000Z",
          urls: [],
        },
      ],
    });

    expect(diagnosis.root).toBe("warning_logs");
    expect(diagnosis.nextAction.command).toBe("devdeck logs worker --agent --severity warning --tail 40");
  });
});
