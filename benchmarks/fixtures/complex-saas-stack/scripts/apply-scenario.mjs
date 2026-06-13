import fs from "node:fs/promises";
import path from "node:path";

import {
  fixtureRoot,
  schedulerHeartbeatPath,
  scenarioStatePath,
  workerHeartbeatPath,
} from "./lib/fixture-paths.mjs";
import { ensureStateDirectories, writeJson } from "./lib/runtime.mjs";

const scenarioId = process.argv[2];

if (!scenarioId) {
  throw new Error("Usage: node scripts/apply-scenario.mjs <scenario-id>");
}

const scenarioPath = path.join(fixtureRoot, "scenarios", `${scenarioId}.json`);
const source = await fs.readFile(scenarioPath, "utf8");
const scenario = JSON.parse(source);

await ensureStateDirectories();
await fs.rm(workerHeartbeatPath, { force: true });
await fs.rm(schedulerHeartbeatPath, { force: true });
await writeJson(scenarioStatePath, scenario);

process.stdout.write(
  `Applied scenario ${scenario.id}: ${scenario.description}\n`,
);
