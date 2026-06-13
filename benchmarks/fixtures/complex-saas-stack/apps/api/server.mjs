import http from "node:http";

import {
  fetchJson,
  loadFixtureEnv,
  log,
  logError,
  readScenarioState,
  recordServicePid,
  tcpCommand,
  wait,
} from "../../scripts/lib/runtime.mjs";

const serviceName = "api";
await recordServicePid(serviceName);
const env = await loadFixtureEnv();
const scenario = await readScenarioState();
const port = Number(env.API_PORT ?? "4000");
const requiredEnv = ["DATABASE_URL", "REDIS_URL", "MOCK_EXTERNAL_API_URL", "SESSION_SECRET"];

for (const key of requiredEnv) {
  if (!env[key]) {
    logError(serviceName, `startup config error: missing required env ${key}`);
  }
}

const missingEnv = requiredEnv.filter((key) => !env[key]);
if (missingEnv.length > 0) {
  logError(serviceName, `missing required env: ${missingEnv.join(", ")}`);
  process.exit(1);
}

async function assertDependenciesReady() {
  const dbReady = await tcpCommand({ host: "127.0.0.1", port: 15432, command: "READY" });
  if (!dbReady.startsWith("READY")) {
    throw new Error(`database not ready: ${dbReady}`);
  }

  const migrationResult = await tcpCommand({ host: "127.0.0.1", port: 15432, command: "MIGRATE" });
  if (!migrationResult.startsWith("OK")) {
    throw new Error(`migration failure: ${migrationResult}`);
  }

  const redisPing = await tcpCommand({ host: "127.0.0.1", port: 16379, command: "PING" });
  if (redisPing !== "PONG") {
    throw new Error(`redis unavailable: ${redisPing}`);
  }

  const { response } = await fetchJson(`${env.MOCK_EXTERNAL_API_URL}/health`);
  if (!response.ok) {
    throw new Error(`mock external api unhealthy: ${response.status}`);
  }
}

async function waitForDependencies(maxAttempts = 12, delayMs = 500) {
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await assertDependenciesReady();
      return;
    } catch (error) {
      lastError = error;
      logError(serviceName, `dependency wait attempt ${attempt}/${maxAttempts}: ${error.message}`);
      if (attempt < maxAttempts) {
        await wait(delayMs);
      }
    }
  }

  throw lastError;
}

try {
  await waitForDependencies();
} catch (error) {
  logError(serviceName, `dependency failure: ${error.message}`);
  process.exit(1);
}

let ready = true;
let hasCrashed = false;
let crashTimer = null;

function triggerCrash(reason) {
  if (hasCrashed) return;
  hasCrashed = true;
  ready = false;
  logError(serviceName, `runtime failure: ${reason}`);
  logError(serviceName, "api exiting with code 1");
  server.close(() => process.exit(1));
}

const crashAfterMs = Number(scenario.runtime?.api?.crashAfterMs ?? 0);
const crashOnDashboardHit = Boolean(scenario.runtime?.api?.crashOnDashboardHit);

const server = http.createServer(async (request, response) => {
  if (request.url === "/health/live") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true, service: serviceName }));
    return;
  }

  if (request.url === "/health/ready") {
    response.writeHead(ready ? 200 : 503, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: ready, service: serviceName }));
    return;
  }

  if (request.url === "/api/dashboard") {
    if (crashOnDashboardHit && !hasCrashed) {
      response.writeHead(500, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "dashboard bootstrap failed" }));
      setImmediate(() => triggerCrash("simulated crash after startup on dashboard access"));
      return;
    }

    try {
      const dashboardData = await tcpCommand({
        host: "127.0.0.1",
        port: 15432,
        command: "DASHBOARD",
      });
      const queueInfo = await tcpCommand({
        host: "127.0.0.1",
        port: 16379,
        command: "INFO",
      });
      const external = await fetchJson(`${env.MOCK_EXTERNAL_API_URL}/v1/billing-status`);
      if (!external.response.ok) {
        throw new Error(`external api returned ${external.response.status}`);
      }

      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          db: JSON.parse(dashboardData),
          queue: JSON.parse(queueInfo),
          billing: external.json,
          session: "active",
        }),
      );
      return;
    } catch (error) {
      logError(serviceName, `business endpoint failure: ${error.message}`);
      response.writeHead(500, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: error.message }));
      return;
    }
  }

  response.writeHead(404, { "content-type": "application/json" });
  response.end(JSON.stringify({ error: "not found" }));
});

server.on("listening", () => {
  log(serviceName, `api listening on http://127.0.0.1:${port}`);
  log(serviceName, "api ready");
});

server.on("error", (error) => {
  logError(serviceName, `server error: ${error.message}`);
  process.exitCode = 1;
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    ready = false;
    if (crashTimer) {
      clearTimeout(crashTimer);
    }
    log(serviceName, `shutting down after ${signal}`);
    server.close(() => process.exit(0));
  });
}

server.listen(port, "127.0.0.1");

if (crashAfterMs > 0) {
  crashTimer = setTimeout(() => {
    triggerCrash("simulated crash after startup");
  }, crashAfterMs);
}
