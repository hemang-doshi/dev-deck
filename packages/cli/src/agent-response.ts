import { randomUUID } from "node:crypto";

import {
  createDevDeckErrorPayload,
  type DevDeckErrorInput,
  type DevDeckErrorPayload,
  type NextAction,
} from "./agent-errors.js";

export const DEVDECK_RESPONSE_SCHEMA_VERSION = "devdeck.response.v1" as const;

export type DevDeckResponse<T> = {
  schemaVersion: typeof DEVDECK_RESPONSE_SCHEMA_VERSION;
  ok: boolean;
  command: string;
  requestId: string;
  project: string | null;
  sessionId: string | null;
  timestamp: string;
  summary: string;
  result: T | null;
  error: DevDeckErrorPayload | null;
  nextActions: NextAction[];
};

export type DevDeckResponseContext = {
  command: string;
  requestId?: string;
  project?: string | null;
  sessionId?: string | null;
  timestamp?: string;
  summary: string;
  nextActions?: NextAction[];
};

export function createRequestId(): string {
  return `req_${randomUUID()}`;
}

export function createSuccessResponse<T>(
  context: DevDeckResponseContext,
  result: T,
): DevDeckResponse<T> {
  return {
    schemaVersion: DEVDECK_RESPONSE_SCHEMA_VERSION,
    ok: true,
    command: context.command,
    requestId: context.requestId ?? createRequestId(),
    project: context.project ?? null,
    sessionId: context.sessionId ?? null,
    timestamp: context.timestamp ?? new Date().toISOString(),
    summary: context.summary,
    result,
    error: null,
    nextActions: context.nextActions ?? [],
  };
}

export function createErrorResponse<T = never>(
  context: DevDeckResponseContext,
  error: DevDeckErrorPayload | DevDeckErrorInput,
): DevDeckResponse<T> {
  const payload = isDevDeckErrorPayload(error) ? error : createDevDeckErrorPayload(error);

  return {
    schemaVersion: DEVDECK_RESPONSE_SCHEMA_VERSION,
    ok: false,
    command: context.command,
    requestId: context.requestId ?? createRequestId(),
    project: context.project ?? null,
    sessionId: context.sessionId ?? null,
    timestamp: context.timestamp ?? new Date().toISOString(),
    summary: context.summary,
    result: null,
    error: payload,
    nextActions: context.nextActions ?? payload.nextActions,
  };
}

export function printJsonResponse<T>(
  response: DevDeckResponse<T>,
  write: (message: string) => void = (message) => process.stdout.write(message),
): void {
  write(`${JSON.stringify(response)}\n`);
}

function isDevDeckErrorPayload(error: DevDeckErrorPayload | DevDeckErrorInput): error is DevDeckErrorPayload {
  return (
    error.severity !== undefined &&
    error.retryable !== undefined &&
    error.evidence !== undefined &&
    error.nextActions !== undefined
  );
}
