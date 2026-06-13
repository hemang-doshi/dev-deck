import fs from "node:fs/promises";

import {
  schedulerHeartbeatPath,
  workerHeartbeatPath,
} from "./lib/fixture-paths.mjs";

const serviceName = process.argv[2];

if (serviceName !== "worker" && serviceName !== "scheduler") {
  process.stderr.write("Usage: node scripts/check-heartbeat.mjs <worker|scheduler>\n");
  process.exit(2);
}

const heartbeatPath = serviceName === "worker"
  ? workerHeartbeatPath
  : schedulerHeartbeatPath;

try {
  const source = await fs.readFile(heartbeatPath, "utf8");
  const heartbeat = JSON.parse(source);
  const ageMs = Date.now() - new Date(heartbeat.updatedAt).getTime();

  if (!Number.isFinite(ageMs) || ageMs > 10_000) {
    throw new Error(`${serviceName} heartbeat is stale (${ageMs}ms)`);
  }

  process.stdout.write(`${serviceName} heartbeat healthy\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
