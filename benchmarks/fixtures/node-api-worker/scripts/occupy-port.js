import http from "node:http";

const port = 3100;

const server = http.createServer((_request, response) => {
  response.writeHead(200, { "content-type": "text/plain" });
  response.end("occupied");
});

server.listen(port, "127.0.0.1", () => {
  console.log(`occupying port ${port}`);
});
