import http from "node:http";

import {
  loadFixtureEnv,
  log,
  logError,
  readScenarioState,
  recordServicePid,
} from "../../scripts/lib/runtime.mjs";

const serviceName = "mock-external-api";
await recordServicePid(serviceName);
await loadFixtureEnv();
const port = 4500;

async function currentMode() {
  const scenario = await readScenarioState();
  return scenario.runtime?.externalApi?.mode ?? "healthy";
}

const server = http.createServer(async (request, response) => {
  const mode = await currentMode();

  if (request.url === "/health") {
    const status = mode === "healthy" ? 200 : 503;
    response.writeHead(status, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: status === 200, mode }));
    return;
  }

  if (request.url === "/v1/billing-status") {
    if (mode === "auth-failure") {
      response.writeHead(401, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "invalid api token" }));
      return;
    }
    if (mode === "rate-limited") {
      response.writeHead(429, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "rate limit exceeded" }));
      return;
    }
    if (mode === "hard-500") {
      response.writeHead(500, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "upstream crashed" }));
      return;
    }

    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ plan: "growth", seats: 12, renewalState: "ok" }));
    return;
  }

  response.writeHead(404, { "content-type": "application/json" });
  response.end(JSON.stringify({ error: "not found" }));
});

server.on("listening", () => {
  log(serviceName, `mock external api listening on http://127.0.0.1:${port}`);
});

server.on("error", (error) => {
  logError(serviceName, `server error: ${error.message}`);
  process.exitCode = 1;
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    log(serviceName, `shutting down after ${signal}`);
    server.close(() => process.exit(0));
  });
}

server.listen(port, "127.0.0.1");
