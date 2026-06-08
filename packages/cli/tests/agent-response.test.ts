import { describe, expect, it } from "vitest";

import { createDevDeckErrorPayload } from "../src/agent-errors.js";
import {
  createErrorResponse,
  createRequestId,
  createSuccessResponse,
  printJsonResponse,
} from "../src/agent-response.js";

describe("agent response contract", () => {
  it("creates a success envelope", () => {
    const response = createSuccessResponse(
      {
        command: "status",
        requestId: "req_test",
        project: "sample",
        sessionId: "session-1",
        timestamp: "2026-06-08T00:00:00.000Z",
        summary: "Session is running.",
        nextActions: [
          {
            type: "command",
            command: "devdeck logs --json",
            reason: "Inspect bounded session logs.",
          },
        ],
      },
      { services: 2 },
    );

    expect(response).toEqual({
      schemaVersion: "devdeck.response.v1",
      ok: true,
      command: "status",
      requestId: "req_test",
      project: "sample",
      sessionId: "session-1",
      timestamp: "2026-06-08T00:00:00.000Z",
      summary: "Session is running.",
      result: { services: 2 },
      error: null,
      nextActions: [
        {
          type: "command",
          command: "devdeck logs --json",
          reason: "Inspect bounded session logs.",
        },
      ],
    });
  });

  it("creates an error envelope with required payload fields", () => {
    const response = createErrorResponse({
      command: "logs",
      requestId: "req_error",
      project: "sample",
      sessionId: "session-1",
      timestamp: "2026-06-08T00:00:00.000Z",
      summary: "Unable to read logs.",
    }, createDevDeckErrorPayload({
      code: "DD-ERR-LOGS",
      message: "Session server did not return logs.",
      severity: "error",
      retryable: true,
      evidence: [{ type: "health", service: "api", check: "session-api", result: "502" }],
      nextActions: [
        {
          type: "command",
          command: "devdeck logs --json",
          reason: "Retry the log query.",
        },
      ],
      hint: "Check whether the session is still running.",
      service: "api",
    }));

    expect(response).toEqual({
      schemaVersion: "devdeck.response.v1",
      ok: false,
      command: "logs",
      requestId: "req_error",
      project: "sample",
      sessionId: "session-1",
      timestamp: "2026-06-08T00:00:00.000Z",
      summary: "Unable to read logs.",
      result: null,
      error: {
        code: "DD-ERR-LOGS",
        message: "Session server did not return logs.",
        severity: "error",
        retryable: true,
        evidence: [{ type: "health", service: "api", check: "session-api", result: "502" }],
        nextActions: [
          {
            type: "command",
            command: "devdeck logs --json",
            reason: "Retry the log query.",
          },
        ],
        hint: "Check whether the session is still running.",
        service: "api",
      },
      nextActions: [
        {
          type: "command",
          command: "devdeck logs --json",
          reason: "Retry the log query.",
        },
      ],
    });
  });

  it("creates request ids with the devdeck prefix", () => {
    expect(createRequestId()).toMatch(/^req_[0-9a-f-]{36}$/);
  });

  it("prints valid JSON", () => {
    const output: string[] = [];
    const response = createSuccessResponse(
      {
        command: "status",
        requestId: "req_print",
        timestamp: "2026-06-08T00:00:00.000Z",
        summary: "Printed response.",
      },
      { ok: true },
    );

    printJsonResponse(response, (message) => output.push(message));

    expect(output).toEqual([`${JSON.stringify(response)}\n`]);
    expect(JSON.parse(output.join(""))).toEqual(response);
  });
});
