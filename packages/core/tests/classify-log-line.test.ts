import { describe, expect, it } from "vitest";

import { classifyLogLine } from "../src/classify-log-line.js";
import { exportSession } from "../src/export-session.js";
import { formatDebugContext } from "../src/format-debug-context.js";

describe("classifyLogLine", () => {
  it("classifies warnings and errors with URL and port extraction", () => {
    const warning = classifyLogLine("Warning: server at http://localhost:3000", "stdout");
    const error = classifyLogLine("Error: boom", "stderr");

    expect(warning.severity).toBe("warning");
    expect(warning.urls).toEqual(["http://localhost:3000"]);
    expect(warning.ports).toEqual([3000]);
    expect(error.severity).toBe("error");
  });

  it("marks stack traces", () => {
    const stackLine = classifyLogLine("    at render (/app/index.js:10:2)", "stderr");

    expect(stackLine.isStackTrace).toBe(true);
  });
});

describe("debug formatting", () => {
  const snapshot = {
    project: "sample",
    startedAt: "2026-05-23T00:00:00.000Z",
    services: [
      {
        name: "web",
        command: "npm run dev",
        cwd: "/tmp/web",
        port: 3000,
        health: "healthy" as const,
        status: "running" as const,
        pid: 10,
        restartCount: 0,
        lastExitCode: null,
        lastSignal: null,
        lastError: null,
      },
      {
        name: "api",
        command: "npm run api",
        cwd: "/tmp/api",
        health: "unreachable" as const,
        status: "error" as const,
        pid: null,
        restartCount: 1,
        lastExitCode: 1,
        lastSignal: null,
        lastError: "boom",
      },
    ],
    logs: [
      {
        id: 1,
        service: "web",
        line: "Warning: http://localhost:3000",
        severity: "warning" as const,
        stream: "stdout" as const,
        timestamp: "2026-05-23T00:00:01.000Z",
        urls: ["http://localhost:3000"],
        ports: [3000],
        isStackTrace: false,
      },
    ],
  };

  it("formats readable debug context", () => {
    const context = formatDebugContext(snapshot);

    expect(context).toContain("Project: sample");
    expect(context).toContain("Health: web=healthy, api=unreachable");
    expect(context).toContain("Known URLs: http://localhost:3000");
  });

  it("exports a deterministic session artifact", () => {
    const output = exportSession(snapshot);

    expect(output).toContain("# DevDeck Session Export");
    expect(output).toContain("## Debug Context");
    expect(output).toContain("Warning: http://localhost:3000");
  });
});
