import http from "node:http";

const port = Number(process.env.PORT ?? "3100");

if (process.env.REQUIRED_API_SECRET === "missing-test") {
  console.error("api startup failed: REQUIRED_API_SECRET is set to missing-test");
  process.exit(1);
}

const server = http.createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true, service: "api" }));
    return;
  }

  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ service: "api", status: "running" }));
});

server.on("listening", () => {
  console.log(`api listening on http://127.0.0.1:${port}`);
  console.log(`health endpoint ready at http://127.0.0.1:${port}/health`);
});

server.on("error", (error) => {
  console.error(`api server error: ${error.message}`);
  process.exitCode = 1;
});

process.on("SIGTERM", () => {
  console.log("api shutting down");
  server.close(() => process.exit(0));
});

process.on("SIGINT", () => {
  console.log("api interrupted");
  server.close(() => process.exit(0));
});

server.listen(port, "127.0.0.1");
