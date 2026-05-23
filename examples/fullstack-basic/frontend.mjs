import http from "node:http";

const server = http.createServer((_request, response) => {
  response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
  response.end("frontend ok\n");
});

server.listen(3000, "127.0.0.1", () => {
  console.log("frontend ready at http://127.0.0.1:3000");
});

shutdownOnSignal(server);

function shutdownOnSignal(activeServer) {
  const stop = () => {
    activeServer.close(() => {
      console.log("frontend stopped");
      process.exit(0);
    });
  };

  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
