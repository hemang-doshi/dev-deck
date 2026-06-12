import type { SessionSnapshot } from "@devdeck/core";
import { describe, expect, it } from "vitest";
import type { AgentLogsResponse } from "./agent-client.js";
import { formatAgentLogs, formatAgentSnapshot, formatAgentStatus } from "./format-agent-output.js";

function createSnapshot(): SessionSnapshot {
  return {
    sessionId: "session-1",
    project: "sample",
    startedAt: "2026-05-23T00:00:00.000Z",
    eventCursor: "cursor-1",
    services: [
      {
        name: "api",
        command: "npm run api",
        cwd: "/repo/api",
        health: "healthy",
        readiness: "ready",
        status: "running",
        pid: 111,
        restartCount: 0,
        blockedBy: [],
        lastReadyAt: "2026-05-23T00:00:01.000Z",
        lastHealthCheckAt: "2026-05-23T00:00:02.000Z",
        lastExitCode: null,
        lastSignal: null,
        lastError: null,
      },
      {
        name: "worker",
        command: "npm run worker",
        cwd: "/repo/worker",
        health: "unreachable",
        readiness: "failed",
        status: "exited",
        pid: null,
        restartCount: 2,
        blockedBy: [],
        lastReadyAt: null,
        lastHealthCheckAt: null,
        lastExitCode: 1,
        lastSignal: null,
        lastError: "job failed",
      },
    ],
    logs: [
      {
        id: 1,
        service: "api",
        line: "boot complete",
        isStackTrace: false,
        ports: [],
        severity: "info",
        stream: "stdout",
        timestamp: "2026-05-23T00:00:01.000Z",
        urls: [],
      },
      {
        id: 2,
        service: "worker",
        line: "> worker",
        isStackTrace: false,
        ports: [],
        severity: "info",
        stream: "stdout",
        timestamp: "2026-05-23T00:00:02.000Z",
        urls: [],
      },
      {
        id: 3,
        service: "worker",
        line: "WARNING queue latency above threshold",
        isStackTrace: false,
        ports: [],
        severity: "warning",
        stream: "stderr",
        timestamp: "2026-05-23T00:00:03.000Z",
        urls: [],
      },
      {
        id: 4,
        service: "worker",
        line: "ERROR job failed",
        isStackTrace: false,
        ports: [],
        severity: "error",
        stream: "stderr",
        timestamp: "2026-05-23T00:00:04.000Z",
        urls: [],
      },
    ],
  };
}

describe("format agent output", () => {
  it("formats compact healthy status output", () => {
    const snapshot = {
      ...createSnapshot(),
      services: [
        {
          ...createSnapshot().services[0],
        },
      ],
      logs: [],
    };

    const output = formatAgentStatus(snapshot);

    expect(output).toContain("STATE running svc=1 fail=0 bad=0 warn=0 err=0");
    expect(output).toContain("S api running ready=ready h=healthy r=0 issue=none");
    expect(output).toContain("NEXT none");
    expect(output).not.toContain("/repo/api");
    expect(output).not.toContain("npm run api");
    expect(output.length).toBeLessThan(500);
  });

  it("formats degraded snapshot output with issues, evidence, and next action", () => {
    const output = formatAgentSnapshot(createSnapshot(), { tail: 10 });

    expect(output).toContain("STATE degraded");
    expect(output).toContain("S worker exited ready=failed h=unreachable r=2 issue=service_failed");
    expect(output).toContain('I error worker service_failed "job failed"');
    expect(output).toContain('E error worker "ERROR job failed"');
    expect(output).toContain("NEXT devdeck service restart worker # failed service");
    expect(output).not.toContain("> worker");
    expect(output).not.toContain("/repo/worker");
    expect(output.length).toBeLessThan(1200);
  });

  it("formats logs as evidence instead of raw streams", () => {
    const result: AgentLogsResponse = {
      project: "sample",
      filters: {
        service: "worker",
        grep: "warning",
        tail: 30,
      },
      totalMatched: 12,
      returned: 12,
      logs: [
        {
          id: 1,
          service: "worker",
          line: "> worker",
          isStackTrace: false,
          ports: [],
          severity: "info",
          stream: "stdout",
          timestamp: "2026-05-23T00:00:01.000Z",
          urls: [],
        },
        {
          id: 2,
          service: "worker",
          line: "WARNING queue latency above threshold",
          isStackTrace: false,
          ports: [],
          severity: "warning",
          stream: "stderr",
          timestamp: "2026-05-23T00:00:02.000Z",
          urls: [],
        },
        {
          id: 3,
          service: "worker",
          line: "WARNING queue latency above threshold",
          isStackTrace: false,
          ports: [],
          severity: "warning",
          stream: "stderr",
          timestamp: "2026-05-23T00:00:03.000Z",
          urls: [],
        },
      ],
    };

    const output = formatAgentLogs(result);

    expect(output).toContain("LOGS worker matched=12 returned=1 omitted=11");
    expect(output).toContain('E warning worker "WARNING queue latency above threshold x2"');
    expect(output).toContain("NEXT devdeck logs worker --agent --grep warning --tail 30 # inspect warning context");
    expect(output).not.toContain("> worker");
  });
});
