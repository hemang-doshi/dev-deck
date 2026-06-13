import net from "node:net";

import {
  loadFixtureEnv,
  log,
  logError,
  readScenarioState,
  recordServicePid,
} from "../../scripts/lib/runtime.mjs";

const serviceName = "redis";
await recordServicePid(serviceName);
await loadFixtureEnv();
const scenario = await readScenarioState();
const port = 16379;
const unavailable = Boolean(scenario.runtime?.redis?.unavailable);
const queue = [];

if (unavailable) {
  logError(serviceName, "configured as unavailable for this scenario");
  process.exit(1);
}

const server = net.createServer((socket) => {
  const remote = `${socket.remoteAddress ?? "unknown"}:${socket.remotePort ?? "?"}`;
  log(serviceName, `connection accepted from ${remote}`);
  socket.setEncoding("utf8");
  let buffer = "";

  socket.on("data", (chunk) => {
    buffer += chunk;
    if (!buffer.includes("\n")) return;
    const [command, ...rest] = buffer.trim().split(/\s+/);
    buffer = "";
    const normalized = command.toUpperCase();

    if (normalized === "PING") {
      socket.write("PONG\n");
      return;
    }

    if (normalized === "INFO") {
      socket.write(`${JSON.stringify({ queueDepth: queue.length, mode: "healthy" })}\n`);
      return;
    }

    if (normalized === "ENQUEUE") {
      const job = rest.join(" ") || `job-${Date.now()}`;
      queue.push(job);
      socket.write(`QUEUED ${job}\n`);
      return;
    }

    if (normalized === "DEQUEUE") {
      const job = queue.shift();
      socket.write(`${job ? `JOB ${job}` : "EMPTY"}\n`);
      return;
    }

    socket.write("ERR UNKNOWN_COMMAND\n");
  });
});

server.on("listening", () => {
  log(serviceName, `redis listening on 127.0.0.1:${port}`);
  log(serviceName, "redis ready");
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
