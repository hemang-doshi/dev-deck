import path from "node:path";
import { fileURLToPath } from "node:url";

export const fixtureRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
export const stateDir = path.join(fixtureRoot, ".fixture-state");
export const pidsDir = path.join(stateDir, "pids");
export const scenarioStatePath = path.join(stateDir, "scenario.json");
export const portOccupierPidPath = path.join(stateDir, "port-occupier.pid");
export const workerHeartbeatPath = path.join(stateDir, "worker-heartbeat.json");
export const schedulerHeartbeatPath = path.join(stateDir, "scheduler-heartbeat.json");
