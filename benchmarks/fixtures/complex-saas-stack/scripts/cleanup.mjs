import fs from "node:fs/promises";
import path from "node:path";

import {
  pidsDir,
  portOccupierPidPath,
  schedulerHeartbeatPath,
  stateDir,
  workerHeartbeatPath,
} from "./lib/fixture-paths.mjs";
import { wait } from "./lib/runtime.mjs";

async function killPid(pid, label) {
  try {
    process.kill(pid, "SIGTERM");
    process.stdout.write(`sent SIGTERM to ${label} pid ${pid}\n`);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ESRCH") {
      process.stdout.write(`${label} pid ${pid} already exited\n`);
      return;
    }
    throw error;
  }
}

async function removePidFiles() {
  try {
    const entries = await fs.readdir(pidsDir);
    for (const entry of entries) {
      const filePath = path.join(pidsDir, entry);
      const pid = Number((await fs.readFile(filePath, "utf8")).trim());
      await killPid(pid, entry.replace(/\.pid$/, ""));
      await fs.rm(filePath, { force: true });
    }
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return;
    }
    throw error;
  }
}

async function removePortOccupier() {
  try {
    const pid = Number((await fs.readFile(portOccupierPidPath, "utf8")).trim());
    await killPid(pid, "port-occupier");
    await fs.rm(portOccupierPidPath, { force: true });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return;
    }
    if (error && typeof error === "object" && "code" in error && error.code === "ESRCH") {
      await fs.rm(portOccupierPidPath, { force: true });
      return;
    }
    throw error;
  }
}

await removePidFiles();
await removePortOccupier();
await wait(300);
await fs.rm(workerHeartbeatPath, { force: true });
await fs.rm(schedulerHeartbeatPath, { force: true });
await fs.mkdir(stateDir, { recursive: true });
process.stdout.write("fixture cleanup complete\n");
