import fs from "node:fs/promises";

import { portOccupierPidPath } from "./lib/fixture-paths.mjs";

try {
  const pid = Number((await fs.readFile(portOccupierPidPath, "utf8")).trim());
  process.kill(pid, "SIGTERM");
  await fs.rm(portOccupierPidPath, { force: true });
  process.stdout.write(`released occupied port helper pid ${pid}\n`);
} catch (error) {
  if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
    process.stdout.write("no occupied port helper pid found\n");
    process.exit(0);
  }
  if (error && typeof error === "object" && "code" in error && error.code === "ESRCH") {
    await fs.rm(portOccupierPidPath, { force: true });
    process.stdout.write("occupied port helper was already gone\n");
    process.exit(0);
  }
  throw error;
}
