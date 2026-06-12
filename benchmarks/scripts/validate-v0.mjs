import path from "node:path";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";

import {
  cliDistPath,
  fileExists,
  getFixtureDirectory,
  getNodeVersion,
  isPortFree,
  repoRoot,
  resultsRoot,
} from "./_shared.mjs";

function ok(message) {
  process.stdout.write(`✓ ${message}\n`);
}

function fail(message) {
  process.stdout.write(`✗ ${message}\n`);
}

export async function validateV0({ fixture = "node-api-worker" } = {}) {
  process.stdout.write("DevDeck benchmark v0 preflight\n\n");

  const fixtureDir = getFixtureDirectory(fixture);
  const fixturePackagePath = path.join(fixtureDir, "package.json");
  const fixtureConfigPath = path.join(fixtureDir, "devdeck.yml");
  const failures = [];

  if (await fileExists(fixtureDir)) {
    ok(`fixture found (${path.relative(repoRoot, fixtureDir)})`);
  } else {
    failures.push(`Missing ${path.relative(repoRoot, fixtureDir)}`);
  }

  if (await fileExists(fixturePackagePath)) {
    ok("fixture package.json found");
  } else {
    failures.push(`Missing ${path.relative(repoRoot, fixturePackagePath)}`);
  }

  if (await fileExists(fixtureConfigPath)) {
    ok("devdeck.yml found");
  } else {
    failures.push(`Missing ${path.relative(repoRoot, fixtureConfigPath)}`);
  }

  const packageJson = await fileExists(fixturePackagePath)
    ? JSON.parse(await readFile(fixturePackagePath, "utf8"))
    : undefined;
  const scripts = packageJson?.scripts ?? {};

  if (scripts.api) {
    ok("api script found");
  } else {
    failures.push(`Missing api script in ${path.relative(repoRoot, fixturePackagePath)}`);
  }

  if (scripts.worker) {
    ok("worker script found");
  } else {
    failures.push(`Missing worker script in ${path.relative(repoRoot, fixturePackagePath)}`);
  }

  if (await fileExists(cliDistPath)) {
    ok("CLI build found");
  } else {
    const cliPackagePath = path.join(repoRoot, "packages/cli/package.json");
    const cliSourcePath = path.join(repoRoot, "packages/cli/src/index.ts");
    if ((await fileExists(cliPackagePath)) && (await fileExists(cliSourcePath))) {
      ok("CLI source found (build can produce dist)");
    } else {
      failures.push(`Missing ${path.relative(repoRoot, cliDistPath)} and CLI source/build inputs`);
    }
  }

  if (await isPortFree(3100)) {
    ok("port 3100 free");
  } else {
    failures.push("Port 3100 is already in use");
  }

  try {
    await mkdir(resultsRoot, { recursive: true });
    const probePath = path.join(resultsRoot, ".preflight-write-test");
    await writeFile(probePath, "ok\n", "utf8");
    await rm(probePath, { force: true });
    ok("results directory writable");
  } catch (error) {
    failures.push(`Results directory is not writable: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (getNodeVersion()) {
    ok(`Node.js available (${getNodeVersion()})`);
  } else {
    failures.push("Node.js version is unavailable");
  }

  if (failures.length > 0) {
    process.stdout.write("\n");
    for (const message of failures) {
      fail(message);
    }
    throw new Error(`Benchmark preflight failed with ${failures.length} issue(s).`);
  }

  process.stdout.write("\nReady.\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await validateV0();
}
