import {
  loadFixtureEnv,
  log,
  logError,
  readScenarioState,
  recordServicePid,
  serviceHeartbeatPath,
  tcpCommand,
  wait,
  writeHeartbeat,
} from "../../scripts/lib/runtime.mjs";

const serviceName = "scheduler";
await recordServicePid(serviceName);
await loadFixtureEnv();
const scenario = await readScenarioState();

async function assertDependenciesReady() {
  const redisPing = await tcpCommand({ host: "127.0.0.1", port: 16379, command: "PING" });
  if (redisPing !== "PONG") {
    throw new Error(`redis ping failed: ${redisPing}`);
  }
  const apiLive = await fetch("http://127.0.0.1:4000/health/live");
  if (!apiLive.ok) {
    throw new Error(`api not live: ${apiLive.status}`);
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

const tickMs = Number(scenario.runtime?.scheduler?.tickMs ?? 3000);
const heartbeatPath = serviceHeartbeatPath(serviceName);
let tick = 0;

log(serviceName, "scheduler started");
await writeHeartbeat(heartbeatPath, { service: serviceName, tick, state: "idle" });

const interval = setInterval(async () => {
  tick += 1;
  log(serviceName, `scheduler tick ${tick}`);
  if (tick % 2 === 0) {
    await tcpCommand({ host: "127.0.0.1", port: 16379, command: `ENQUEUE scheduled-${tick}` }).catch(() => {});
  }
  await writeHeartbeat(heartbeatPath, { service: serviceName, tick, state: "running" });
}, tickMs);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    clearInterval(interval);
    log(serviceName, `shutting down after ${signal}`);
    await writeHeartbeat(heartbeatPath, { service: serviceName, tick, state: "stopped" });
    process.exit(0);
  });
}
