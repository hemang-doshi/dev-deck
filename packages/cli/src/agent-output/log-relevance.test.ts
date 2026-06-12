import { describe, expect, it } from "vitest";
import {
  isBoilerplateLogLine,
  isErrorLine,
  isWarningLine,
  normalizeEvidenceLine,
  summarizeLogEvidence,
} from "./log-relevance.js";

describe("log relevance", () => {
  it("detects boilerplate lines", () => {
    expect(isBoilerplateLogLine("> api")).toBe(true);
    expect(isBoilerplateLogLine("> node src/api.js")).toBe(true);
    expect(isBoilerplateLogLine("ERROR database connection lost")).toBe(false);
  });

  it("classifies error and warning patterns", () => {
    expect(isErrorLine("database connection lost")).toBe(true);
    expect(isWarningLine("queue latency above threshold")).toBe(true);
  });

  it("normalizes long evidence lines", () => {
    const normalized = normalizeEvidenceLine(`  ${"x".repeat(200)}  `);
    expect(normalized.endsWith("...")).toBe(true);
    expect(normalized.length).toBe(140);
  });

  it("deduplicates warnings and drops normal heartbeat noise", () => {
    const evidence = summarizeLogEvidence([
      { service: "worker", severity: "info", line: "> worker" },
      { service: "worker", severity: "info", line: "heartbeat ok" },
      { service: "worker", severity: "warning", line: "WARNING queue latency above threshold" },
      { service: "worker", severity: "warning", line: "WARNING queue latency above threshold" },
      { service: "api", severity: "error", line: "ERROR database connection lost" },
    ]);

    expect(evidence).toEqual([
      {
        service: "api",
        severity: "error",
        line: "ERROR database connection lost",
        source: "log",
        count: 1,
      },
      {
        service: "worker",
        severity: "warning",
        line: "WARNING queue latency above threshold",
        source: "log",
        count: 2,
      },
    ]);
  });
});
