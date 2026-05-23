import { readFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";

import { exportSession, type LogSeverity, type ServiceSession } from "@devdeck/core";

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
  const severity = parseSeverity(optionalString(searchParams.get("severity")));
  const tail = parseTail(optionalString(searchParams.get("tail")));

  return {
    service,
    grep,
    severity,
    tail,
  };
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
