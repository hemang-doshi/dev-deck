import http from "node:http";

const server = http.createServer((_request, response) => {
  response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify({ ok: true }));
});

server.listen(4000, "127.0.0.1", () => {
  console.log("backend listening on http://127.0.0.1:4000");
});

setTimeout(() => {
  console.warn("Warning: backend cache is warming slowly");
}, 600);

setTimeout(() => {
  console.error("Error: backend intentionally crashed for the demo flow");
  server.close(() => {
    process.exit(1);
  });
}, 1800);

shutdownOnSignal(server);

function shutdownOnSignal(activeServer) {
  const stop = () => {
    activeServer.close(() => {
      console.log("backend stopped");
      process.exit(0);
    });
  };

  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
