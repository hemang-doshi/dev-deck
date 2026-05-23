import { describe, expect, it } from "vitest";

import { LogBuffer } from "../src/log-buffer.js";

describe("LogBuffer", () => {
  it("keeps only the newest entries within the configured bound", () => {
    const buffer = new LogBuffer(2);

    buffer.append({
      id: 1,
      isStackTrace: false,
      service: "web",
      line: "first",
      ports: [],
      severity: "info",
      stream: "stdout",
      timestamp: "2026-05-23T00:00:00.000Z",
      urls: [],
    });
    buffer.append({
      id: 2,
      isStackTrace: false,
      service: "web",
      line: "second",
      ports: [],
      severity: "info",
      stream: "stdout",
      timestamp: "2026-05-23T00:00:01.000Z",
      urls: [],
    });
    buffer.append({
      id: 3,
      isStackTrace: false,
      service: "web",
      line: "third",
      ports: [],
      severity: "info",
      stream: "stdout",
      timestamp: "2026-05-23T00:00:02.000Z",
      urls: [],
    });

    expect(buffer.snapshot().map((entry) => entry.line)).toEqual(["second", "third"]);
  });

  it("preserves append order", () => {
    const buffer = new LogBuffer(3);

    for (const line of ["one", "two", "three"]) {
      buffer.append({
        id: buffer.snapshot().length + 1,
        isStackTrace: false,
        service: "web",
        line,
        ports: [],
        severity: "info",
        stream: "stdout",
        timestamp: new Date().toISOString(),
        urls: [],
      });
    }

    expect(buffer.snapshot().map((entry) => entry.line)).toEqual(["one", "two", "three"]);
  });
});
