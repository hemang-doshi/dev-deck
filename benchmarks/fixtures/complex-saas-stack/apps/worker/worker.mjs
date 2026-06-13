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

const serviceName = "worker";
await recordServicePid(serviceName);
await loadFixtureEnv();
const scenario = await readScenarioState();

async function assertDependenciesReady() {
  const redisPing = await tcpCommand({ host: "127.0.0.1", port: 16379, command: "PING" });
  if (redisPing !== "PONG") {
    throw new Error(`redis ping failed: ${redisPing}`);
  }
  const apiReady = await fetch("http://127.0.0.1:4000/health/ready");
  if (!apiReady.ok) {
    throw new Error(`api not ready: ${apiReady.status}`);
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

const noisy = Boolean(scenario.runtime?.worker?.noisy);
const stuckJob = Boolean(scenario.runtime?.worker?.stuckJob);
const intervalMs = noisy ? 300 : 2000;
const heartbeatPath = serviceHeartbeatPath(serviceName);
let tick = 0;
let interval = null;

async function writeWorkerHeartbeat(state) {
  await writeHeartbeat(heartbeatPath, {
    service: serviceName,
    tick,
    state,
  });
}

log(serviceName, "worker ready");
await writeWorkerHeartbeat(stuckJob ? "stuck" : "idle");

interval = setInterval(async () => {
  tick += 1;
  log(serviceName, `polling queue tick=${tick}`);

  if (noisy) {
    log(serviceName, "debug queue scan complete");
    log(serviceName, "debug cache refresh complete");
  }

  if (stuckJob) {
    logError(serviceName, "job checkout_1742 is stuck waiting on downstream ack");
    await writeWorkerHeartbeat("stuck");
    return;
  }

  if (noisy && tick % 5 === 0) {
    logError(serviceName, "warning: queue latency above threshold");
  }

  if (tick % 3 === 0) {
    await tcpCommand({ host: "127.0.0.1", port: 16379, command: `ENQUEUE job-${tick}` }).catch(() => {});
    await tcpCommand({ host: "127.0.0.1", port: 16379, command: "DEQUEUE" }).catch(() => {});
  }

  await writeWorkerHeartbeat("idle");
}, intervalMs);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    if (interval) {
      clearInterval(interval);
    }
    log(serviceName, `shutting down after ${signal}`);
    await writeWorkerHeartbeat("stopped");
    process.exit(0);
  });
}
