let heartbeat = 0;
const noisy = process.env.NOISY_WORKER === "1";
const intervalMs = Number(process.env.WORKER_LOG_INTERVAL_MS ?? (noisy ? "500" : "2000"));
const warnEvery = Number(process.env.WORKER_WARN_EVERY ?? "5");

console.log("worker booted");

const interval = setInterval(() => {
  heartbeat += 1;
  console.log(`worker heartbeat ${heartbeat}`);

  if (noisy) {
    console.log("debug: polling queue");
    console.log("debug: cache refresh completed");
  }

  if (noisy && heartbeat % warnEvery === 0) {
    console.warn("warning: queue latency above threshold");
  } else if (!noisy && heartbeat === 3) {
    console.warn("worker warning: simulated backlog spike");
  }
}, intervalMs);

function shutdown(signal) {
  console.log(`worker shutting down after ${signal}`);
  clearInterval(interval);
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
