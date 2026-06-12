import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";

import {
  appendTranscript,
  createRunDirectory,
  ensureEmptyDirectory,
  fileExists,
  getEnvironmentSummary,
  getFixtureDirectory,
  parseRunDirArgument,
  quote,
  repoRoot,
  runCommand,
  writeJson,
} from "./_shared.mjs";

function defaultDevDeckBin() {
  const cliPath = path.join(repoRoot, "packages/cli/dist/index.js");
  return `node ${quote(cliPath)}`;
}

async function ensureCliBuilt() {
  const cliPath = path.join(repoRoot, "packages/cli/dist/index.js");
  if (!(await fileExists(cliPath))) {
    await runCommand("npm run build --workspace @hemangdoshi/devdeck", { cwd: repoRoot });
  }
}

async function runDevDeckCommand(
  command,
  { cwd, transcriptPath, outputPath, allowFailure = false, recordTranscript = true } = {},
) {
  const result = await runCommand(command, { cwd, allowFailure });
  if (recordTranscript) {
    await appendTranscript(transcriptPath, command, result.combined || "(no output)");
  }

  if (outputPath) {
    const content = result.stdout || result.stderr;
    await writeFile(outputPath, content, "utf8");
  }

  return result;
}

export async function runDevDeck({ runDir, fixture = "node-api-worker" } = {}) {
  const resolvedRunDir = await createRunDirectory(runDir);
  const devdeckDir = path.join(resolvedRunDir, "devdeck");
  const fixtureDir = getFixtureDirectory(fixture);
  const transcriptPath = path.join(devdeckDir, "transcript.txt");
  const statusPath = path.join(devdeckDir, "status.json");
  const apiLogsPath = path.join(devdeckDir, "api-logs.txt");
  const workerLogsPath = path.join(devdeckDir, "worker-logs.txt");
  const snapshotPath = path.join(devdeckDir, "snapshot.md");
  const runJsonPath = path.join(devdeckDir, "run.json");
  const commands = [];
  const observations = [];
  const startedAt = new Date().toISOString();
  const devdeckBin = process.env.DEVDECK_BIN ?? defaultDevDeckBin();

  await ensureCliBuilt();
  await ensureEmptyDirectory(devdeckDir);

  const baseCommand = (suffix) => `${devdeckBin} ${suffix}`;

  try {
    await runDevDeckCommand(baseCommand("stop --json"), {
      cwd: fixtureDir,
      transcriptPath,
      allowFailure: true,
      recordTranscript: false,
    });

    await runDevDeckCommand(baseCommand("start"), {
      cwd: fixtureDir,
      transcriptPath,
    });
    commands.push("devdeck start");
    observations.push("DevDeck started in the background");

    await runDevDeckCommand(baseCommand("status --json"), {
      cwd: fixtureDir,
      transcriptPath,
      outputPath: statusPath,
    });
    commands.push("devdeck status --json");

    await runDevDeckCommand(baseCommand("logs api --tail 80"), {
      cwd: fixtureDir,
      transcriptPath,
      outputPath: apiLogsPath,
    });
    commands.push("devdeck logs api --tail 80");

    await runDevDeckCommand(baseCommand("logs worker --tail 80"), {
      cwd: fixtureDir,
      transcriptPath,
      outputPath: workerLogsPath,
    });
    commands.push("devdeck logs worker --tail 80");

    await runDevDeckCommand(baseCommand("snapshot"), {
      cwd: fixtureDir,
      transcriptPath,
      outputPath: snapshotPath,
    });
    commands.push("devdeck snapshot");

    await runDevDeckCommand(baseCommand("service restart api"), {
      cwd: fixtureDir,
      transcriptPath,
    });
    commands.push("devdeck service restart api");
    observations.push("DevDeck restart request issued for api");

    await runDevDeckCommand(baseCommand("stop"), {
      cwd: fixtureDir,
      transcriptPath,
    });
    commands.push("devdeck stop");

    const runData = {
      mode: "devdeck",
      fixture,
      startedAt,
      endedAt: new Date().toISOString(),
      commands,
      observations,
      exitCode: 0,
      environment: {
        ...getEnvironmentSummary(),
        devdeckVersion: JSON.parse(await readFile(path.join(repoRoot, "packages/cli/package.json"), "utf8")).version,
        bin: devdeckBin,
      },
      outputs: {
        transcript: transcriptPath,
        status: statusPath,
        apiLogs: apiLogsPath,
        workerLogs: workerLogsPath,
        snapshot: snapshotPath,
      },
    };

    await writeJson(runJsonPath, runData);
    return { runDir: resolvedRunDir, devdeckDir, runJsonPath };
  } catch (error) {
    await runCommand(baseCommand("stop --json"), { cwd: fixtureDir, allowFailure: true }).catch(() => {});

    const runData = {
      mode: "devdeck",
      fixture,
      startedAt,
      endedAt: new Date().toISOString(),
      commands,
      observations,
      exitCode: 1,
      error: error instanceof Error ? error.message : String(error),
      environment: getEnvironmentSummary(),
    };

    await writeJson(runJsonPath, runData);
    throw error;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const runDir = parseRunDirArgument(process.argv.slice(2));
  const result = await runDevDeck({ runDir });
  process.stdout.write(`${result.runDir}\n`);
}
