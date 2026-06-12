import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";

import {
  cliDistPath,
  createRunDirectory,
  ensureEmptyDirectory,
  fileExists,
  getEnvironmentSummary,
  getFixtureDirectory,
  parseRunDirArgument,
  quote,
  recordCommandEvent,
  repoRoot,
  runCommand,
  writeCommandEvents,
  writeJson,
} from "./_shared.mjs";

function defaultDevDeckBin() {
  return `node ${quote(cliDistPath)}`;
}

async function ensureCliBuilt() {
  if (!(await fileExists(cliDistPath))) {
    await runCommand("npm run build --workspace @hemangdoshi/devdeck", { cwd: repoRoot });
  }
}

async function runDevDeckCommand(
  command,
  {
    cwd,
    transcriptPath,
    outputPath,
    allowFailure = false,
    recordTranscript = true,
    events,
    id,
    commandLabel = command,
    category,
  } = {},
) {
  const startedAt = new Date().toISOString();
  const result = await runCommand(command, { cwd, allowFailure: true });
  const output = result.combined || "(no output)";

  await recordCommandEvent({
    events,
    transcriptPath,
    recordTranscript,
    id,
    mode: "devdeck",
    scenario: "happy-path",
    commandLabel,
    command,
    transcriptCommand: command,
    category,
    output,
    startedAt,
    endedAt: new Date().toISOString(),
    exitCode: result.code,
  });

  if (outputPath) {
    const content = result.stdout || result.stderr;
    await writeFile(outputPath, content, "utf8");
  }

  if (!allowFailure && result.code !== 0) {
    throw new Error(`Command failed (${result.code}): ${command}\n${result.combined.trim()}`);
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
  const commandEvents = [];
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
      events: commandEvents,
    });

    await runDevDeckCommand(baseCommand("start"), {
      cwd: fixtureDir,
      transcriptPath,
      events: commandEvents,
      id: "devdeck-start",
      commandLabel: "devdeck start",
      category: "startup",
    });
    commands.push("devdeck start");
    observations.push("DevDeck started in the background");

    await runDevDeckCommand(baseCommand("status --json"), {
      cwd: fixtureDir,
      transcriptPath,
      outputPath: statusPath,
      events: commandEvents,
      id: "devdeck-status-json",
      commandLabel: "devdeck status --json",
      category: "state",
    });
    commands.push("devdeck status --json");

    await runDevDeckCommand(baseCommand("logs api --tail 80"), {
      cwd: fixtureDir,
      transcriptPath,
      outputPath: apiLogsPath,
      events: commandEvents,
      id: "devdeck-api-logs",
      commandLabel: "devdeck logs api --tail 80",
      category: "logs",
    });
    commands.push("devdeck logs api --tail 80");

    await runDevDeckCommand(baseCommand("logs worker --tail 80"), {
      cwd: fixtureDir,
      transcriptPath,
      outputPath: workerLogsPath,
      events: commandEvents,
      id: "devdeck-worker-logs",
      commandLabel: "devdeck logs worker --tail 80",
      category: "logs",
    });
    commands.push("devdeck logs worker --tail 80");

    await runDevDeckCommand(baseCommand("snapshot"), {
      cwd: fixtureDir,
      transcriptPath,
      outputPath: snapshotPath,
      events: commandEvents,
      id: "devdeck-snapshot",
      commandLabel: "devdeck snapshot",
      category: "snapshot",
    });
    commands.push("devdeck snapshot");

    await runDevDeckCommand(baseCommand("service restart api"), {
      cwd: fixtureDir,
      transcriptPath,
      events: commandEvents,
      id: "devdeck-restart-api",
      commandLabel: "devdeck service restart api",
      category: "control",
    });
    commands.push("devdeck service restart api");
    observations.push("DevDeck restart request issued for api");

    await runDevDeckCommand(baseCommand("stop"), {
      cwd: fixtureDir,
      transcriptPath,
      events: commandEvents,
      id: "devdeck-stop",
      commandLabel: "devdeck stop",
      category: "cleanup",
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

    await writeCommandEvents(devdeckDir, commandEvents);
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

    await writeCommandEvents(devdeckDir, commandEvents);
    await writeJson(runJsonPath, runData);
    throw error;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const runDir = parseRunDirArgument(process.argv.slice(2));
  const result = await runDevDeck({ runDir });
  process.stdout.write(`${result.runDir}\n`);
}
