import { spawn } from "node:child_process";
import http from "node:http";
import fs from "node:fs/promises";

import { portOccupierPidPath } from "./lib/fixture-paths.mjs";

const args = process.argv.slice(2);
const daemonize = args.includes("--daemonize");
const portArg = args.find((value) => /^\d+$/.test(value));
const port = Number(portArg ?? "4000");

if (daemonize) {
  const child = spawn(process.execPath, [new URL(import.meta.url).pathname, String(port)], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  await fs.writeFile(portOccupierPidPath, `${child.pid}\n`, "utf8");
  process.stdout.write(`port occupier started on ${port} with pid ${child.pid}\n`);
  process.exit(0);
}

const server = http.createServer((_request, response) => {
  response.writeHead(200, { "content-type": "text/plain" });
  response.end("occupied");
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`occupying port ${port}\n`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
