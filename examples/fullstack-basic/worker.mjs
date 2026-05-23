let attempt = 0;

console.log("worker booted");

const timer = setInterval(() => {
  attempt += 1;
  console.log(`worker processed job ${attempt}`);

  if (attempt % 3 === 0) {
    console.warn(`Warning: worker retrying job ${attempt}`);
  }
}, 700);

process.on("SIGINT", stop);
process.on("SIGTERM", stop);

function stop() {
  clearInterval(timer);
  console.log("worker stopped");
  process.exit(0);
}
