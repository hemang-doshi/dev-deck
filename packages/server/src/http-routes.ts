import { readFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";

import { exportSession, type ServiceSession } from "@devdeck/core";

import { loadDashboardAsset } from "./dashboard-assets.js";

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
