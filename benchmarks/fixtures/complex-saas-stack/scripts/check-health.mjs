import fs from "node:fs/promises";
import net from "node:net";

import {
  schedulerHeartbeatPath,
  workerHeartbeatPath,
} from "./lib/fixture-paths.mjs";
import { fetchJson, loadFixtureEnv, parseUrlPort, tcpCommand } from "./lib/runtime.mjs";

function assertRecentHeartbeat(name, filePath, maxAgeMs = 10000) {
  return fs.readFile(filePath, "utf8").then((source) => {
    const heartbeat = JSON.parse(source);
    const age = Date.now() - new Date(heartbeat.updatedAt).getTime();
    if (Number.isNaN(age) || age > maxAgeMs) {
      throw new Error(`${name} heartbeat is stale (${age}ms)`);
    }
    return heartbeat;
  });
}

async function checkTcp(host, port) {
  await new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    socket.on("connect", () => {
      socket.end();
      resolve();
    });
    socket.on("error", reject);
  });
}

const env = await loadFixtureEnv();
const apiPort = Number(env.API_PORT ?? "4000");
const webPort = Number(env.WEB_PORT ?? "3000");
const externalPort = parseUrlPort(env.MOCK_EXTERNAL_API_URL ?? "http://127.0.0.1:4500", 4500);

const checks = [
  fetchJson(`http://127.0.0.1:${webPort}/healthz`).then(({ response }) => {
    if (!response.ok) throw new Error(`web health failed with ${response.status}`);
  }),
  fetchJson(`http://127.0.0.1:${apiPort}/health/live`).then(({ response }) => {
    if (!response.ok) throw new Error(`api live failed with ${response.status}`);
  }),
  fetchJson(`http://127.0.0.1:${apiPort}/health/ready`).then(({ response }) => {
    if (!response.ok) throw new Error(`api ready failed with ${response.status}`);
  }),
  fetchJson(`http://127.0.0.1:${externalPort}/health`).then(({ response }) => {
    if (!response.ok) throw new Error(`mock external api health failed with ${response.status}`);
  }),
  checkTcp("127.0.0.1", 15432),
  checkTcp("127.0.0.1", 16379),
  tcpCommand({ host: "127.0.0.1", port: 15432, command: "READY" }).then((message) => {
    if (!message.startsWith("READY")) throw new Error(`postgres not ready: ${message}`);
  }),
  tcpCommand({ host: "127.0.0.1", port: 16379, command: "PING" }).then((message) => {
    if (message !== "PONG") throw new Error(`redis ping failed: ${message}`);
  }),
  assertRecentHeartbeat("worker", workerHeartbeatPath),
  assertRecentHeartbeat("scheduler", schedulerHeartbeatPath),
];

await Promise.all(checks);
process.stdout.write("fixture health checks passed\n");
