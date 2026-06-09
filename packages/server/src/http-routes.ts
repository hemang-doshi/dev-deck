import { readFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";

import {
  exportSession,
  type DevDeckEventType,
  type LogSeverity,
  type LogStream,
  type ServiceSession,
  type SeverityText,
} from "@devdeck/core";

import { loadDashboardAsset } from "./dashboard-assets.js";
import { queryLogs, type LogQueryFilters } from "./log-query.js";

export type ActionName = "start" | "stop" | "restart" | "stop-session";

export type ActionRequest = {
  action: ActionName;
  serviceName?: string;
};

export type HttpRouteOptions = {
  dashboardAssetsDirectory: string;
  session: ServiceSession;
  onAction: (action: ActionRequest) => Promise<{ ok: boolean; error?: string }>;
};

export async function handleHttpRequest(
  request: IncomingMessage,
  response: ServerResponse,
  options: HttpRouteOptions,
): Promise<void> {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");

  if (request.method === "GET" && url.pathname === "/health") {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(
      JSON.stringify({
        ok: true,
        project: options.session.getSnapshot().project,
        services: options.session.getSnapshot().services,
      }),
    );
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/actions") {
    const body = await readRequestBody(request);
    const action = JSON.parse(body) as ActionRequest;
    const result = await options.onAction(action);

    response.writeHead(result.ok ? 200 : 400, {
      "content-type": "application/json; charset=utf-8",
    });
    response.end(JSON.stringify(result));
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/export") {
    response.writeHead(200, {
      "content-type": "text/plain; charset=utf-8",
      "content-disposition": 'attachment; filename="devdeck-session.txt"',
    });
    response.end(exportSession(options.session.getSnapshot()));
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/snapshot") {
    respondJson(response, 200, options.session.getSnapshot());
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/v1/session") {
    const snapshot = options.session.getSnapshot();
    respondJson(response, 200, {
      sessionId: snapshot.sessionId,
      project: snapshot.project,
      projectRoot: snapshot.projectRoot,
      startedAt: snapshot.startedAt,
      eventCursor: snapshot.eventCursor,
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/v1/snapshot") {
    respondJson(response, 200, options.session.getSnapshot());
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/v1/services") {
    respondJson(response, 200, {
      services: options.session.getSnapshot().services,
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/v1/events") {
    try {
      const filters = parseEventQuery(url.searchParams);
      const events = options.session.events.query(filters);
      respondJson(response, 200, {
        project: options.session.project,
        sessionId: options.session.sessionId,
        eventCursor: options.session.events.latestCursor(),
        returned: events.length,
        events,
      });
    } catch (error) {
      respondJson(response, 400, {
        ok: false,
        error: error instanceof Error ? error.message : "Invalid event query",
      });
    }
    return;
  }

  const serviceLogsMatch = /^\/api\/v1\/services\/([^/]+)\/logs$/.exec(url.pathname);
  if (request.method === "GET" && serviceLogsMatch) {
    try {
      const service = decodeURIComponent(serviceLogsMatch[1] ?? "");
      const filters = parseLogQuery(url.searchParams);
      respondJson(response, 200, queryLogs(options.session.getSnapshot(), {
        ...filters,
        service,
      }));
    } catch (error) {
      respondJson(response, 400, {
        ok: false,
        error: error instanceof Error ? error.message : "Invalid log query",
      });
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/logs") {
    try {
      const filters = parseLogQuery(url.searchParams);
      respondJson(response, 200, queryLogs(options.session.getSnapshot(), filters));
    } catch (error) {
      respondJson(response, 400, {
        ok: false,
        error: error instanceof Error ? error.message : "Invalid log query",
      });
    }
    return;
  }

  try {
    const asset = await loadDashboardAsset(options.dashboardAssetsDirectory, url.pathname);
    response.writeHead(200, { "content-type": asset.contentType });
    response.end(asset.body);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}

async function readRequestBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf8");
}

function parseLogQuery(searchParams: URLSearchParams): LogQueryFilters {
  const service = optionalString(searchParams.get("service"));
  const grep = optionalString(searchParams.get("grep"));
  const stream = parseStream(optionalString(searchParams.get("stream")));
  const errors = searchParams.has("errors") ? parseBooleanFlag(searchParams.get("errors")) : undefined;
  const context = parseOptionalNonNegativeInteger(optionalString(searchParams.get("context")), "context");
  const since = optionalString(searchParams.get("since"));
  const severity = parseSeverity(optionalString(searchParams.get("severity")));
  const tail = parseTail(optionalString(searchParams.get("tail")));

  return {
    service,
    grep,
    stream,
    errors,
    context,
    since,
    severity,
    tail,
  };
}

function parseEventQuery(searchParams: URLSearchParams) {
  const service = optionalString(searchParams.get("service"));
  const type = parseEventType(optionalString(searchParams.get("type")));
  const severity = parseEventSeverity(optionalString(searchParams.get("severity")));
  const tail = parseTail(optionalString(searchParams.get("tail")));
  const since = optionalString(searchParams.get("since"));
  const sinceTimestamp = optionalString(searchParams.get("sinceTimestamp"));
  const grep = optionalString(searchParams.get("grep"));

  return {
    service,
    type,
    severity,
    tail,
    since,
    sinceTimestamp,
    grep,
  };
}

function parseEventType(value?: string): DevDeckEventType | undefined {
  if (!value) {
    return undefined;
  }

  const eventTypes: DevDeckEventType[] = [
    "session.started",
    "session.stopping",
    "session.stopped",
    "service.pending",
    "service.spawned",
    "service.running",
    "service.ready",
    "service.health_changed",
    "service.log",
    "service.exited",
    "service.failed",
    "action.started",
    "action.completed",
    "action.failed",
  ];

  if (eventTypes.includes(value as DevDeckEventType)) {
    return value as DevDeckEventType;
  }

  throw new Error("Invalid event type.");
}

function parseEventSeverity(value?: string): SeverityText | undefined {
  if (!value) {
    return undefined;
  }

  const upper = value.toUpperCase();
  if (upper === "TRACE" || upper === "DEBUG" || upper === "INFO" || upper === "WARN" || upper === "ERROR" || upper === "FATAL") {
    return upper;
  }

  throw new Error("Invalid severity. Expected trace, debug, info, warn, error, or fatal.");
}

function parseSeverity(value?: string): LogSeverity | undefined {
  if (!value) {
    return undefined;
  }

  if (value === "info" || value === "warning" || value === "error") {
    return value;
  }

  throw new Error("Invalid severity. Expected info, warning, or error.");
}

function parseTail(value?: string): number {
  if (!value) {
    return 80;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error("Invalid tail. Expected a positive integer.");
  }

  return parsed;
}

function parseOptionalNonNegativeInteger(value: string | undefined, name: string): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Invalid ${name}. Expected a non-negative integer.`);
  }

  return parsed;
}

function parseStream(value?: string): LogStream | undefined {
  if (!value) {
    return undefined;
  }

  if (value === "stdout" || value === "stderr") {
    return value;
  }

  throw new Error("Invalid stream. Expected stdout or stderr.");
}

function parseBooleanFlag(value: string | null): boolean {
  return value === null || value === "" || value === "true" || value === "1";
}

function optionalString(value: string | null): string | undefined {
  if (!value) {
    return undefined;
  }

  return value;
}

function respondJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(body));
}
