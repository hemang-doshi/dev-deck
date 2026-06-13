import net from "node:net";

import {
  loadFixtureEnv,
  log,
  logError,
  readScenarioState,
  recordServicePid,
} from "../../scripts/lib/runtime.mjs";

const serviceName = "postgres";
await recordServicePid(serviceName);
const env = await loadFixtureEnv();
const scenario = await readScenarioState();
const port = 15432;
const readinessDelayMs = Number(scenario.runtime?.postgres?.readinessDelayMs ?? 0);
const migrationFailure = Boolean(scenario.runtime?.postgres?.migrationFailure);
const startedAt = Date.now();

function isReady() {
  return Date.now() - startedAt >= readinessDelayMs;
}

const server = net.createServer((socket) => {
  const remote = `${socket.remoteAddress ?? "unknown"}:${socket.remotePort ?? "?"}`;
  log(serviceName, `connection accepted from ${remote}`);
  socket.setEncoding("utf8");
  let buffer = "";

  socket.on("data", (chunk) => {
    buffer += chunk;
    if (!buffer.includes("\n")) return;
    const command = buffer.trim().toUpperCase();
    buffer = "";

    if (command === "PING") {
      socket.write("PONG\n");
      return;
    }

    if (command === "READY") {
      if (isReady()) {
        socket.write("READY postgres ready\n");
      } else {
        socket.write(`WAIT ${Math.max(0, readinessDelayMs - (Date.now() - startedAt))}\n`);
      }
      return;
    }

    if (command === "MIGRATE") {
      if (!isReady()) {
        socket.write("ERR NOT_READY\n");
        return;
      }
      if (migrationFailure) {
        socket.write("ERR MIGRATION_FAILED\n");
        logError(serviceName, "migration failed for deterministic scenario");
        return;
      }
      socket.write("OK MIGRATIONS_APPLIED\n");
      log(serviceName, `migration completed for ${env.DATABASE_URL}`);
      return;
    }

    if (command === "DASHBOARD") {
      socket.write(
        `${JSON.stringify({ activeUsers: 37, queuedJobs: 4, mrr: 12000, source: "mock-postgres" })}\n`,
      );
      return;
    }

    socket.write("ERR UNKNOWN_COMMAND\n");
  });
});

server.on("listening", () => {
  log(serviceName, `postgres listening on 127.0.0.1:${port}`);
  setTimeout(() => {
    log(serviceName, "postgres ready");
  }, readinessDelayMs);
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
