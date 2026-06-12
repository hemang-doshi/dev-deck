let heartbeat = 0;

console.log("worker booted");

const interval = setInterval(() => {
  heartbeat += 1;
  console.log(`worker heartbeat ${heartbeat}`);

  if (heartbeat === 3) {
    console.warn("worker warning: simulated backlog spike");
  }
}, 2000);

function shutdown(signal) {
  console.log(`worker shutting down after ${signal}`);
  clearInterval(interval);
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
