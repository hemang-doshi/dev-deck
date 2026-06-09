import { describe, expect, it } from "vitest";

import { buildErrorBlocks } from "../src/error-blocks.js";
import type { DevDeckEvent } from "../src/events.js";

describe("buildErrorBlocks", () => {
  it("groups stderr error lines and stack continuations deterministically", () => {
    const blocks = buildErrorBlocks([
      event("evt_000001", "api", "stderr", "Error: listen EADDRINUSE"),
      event("evt_000002", "api", "stderr", "    at Server.listen (node:net:1:1)"),
      event("evt_000003", "api", "stdout", "ready", "INFO"),
    ]);

    expect(blocks).toEqual([
      {
        id: "err_000001",
        service: "api",
        firstEventId: "evt_000001",
        lastEventId: "evt_000002",
        startedAt: "2026-05-23T00:00:00.000Z",
        endedAt: "2026-05-23T00:00:00.000Z",
        severity: "fatal",
        title: "Error: listen EADDRINUSE",
        lines: ["Error: listen EADDRINUSE", "    at Server.listen (node:net:1:1)"],
        probableCodes: ["EADDRINUSE"],
      },
    ]);
  });

  it("creates warning-only blocks without diagnosis", () => {
    const blocks = buildErrorBlocks([
      event("evt_000001", "api", "stdout", "Warning: backend degraded", "WARN"),
    ]);

    expect(blocks[0]).toMatchObject({
      severity: "warning",
      title: "Warning: backend degraded",
      probableCodes: [],
    });
  });
});

function event(
  id: string,
  service: string,
  stream: "stdout" | "stderr",
  body: string,
  severityText: "INFO" | "WARN" | "ERROR" = "ERROR",
): DevDeckEvent {
  return {
    schemaVersion: "devdeck.event.v1",
    id,
    sessionId: "session",
    project: "sample",
    timestamp: "2026-05-23T00:00:00.000Z",
    observedTimestamp: "2026-05-23T00:00:00.000Z",
    type: "service.log",
    service,
    stream,
    severityText,
    body,
  };
}
