import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";

import {
  cliDistPath,
  createRunDirectory,
  ensureEmptyDirectory,
  fileExists,
  getEnvironmentSummary,
  getFixtureDirectory,
  quote,
  recordCommandEvent,
  repoRoot,
  runCommand,
  sleep,
  spawnLoggedProcess,
  stopProcess,
  tailFile,
  waitForHttp,
  writeCommandEvents,
  writeJson,
} from "./_shared.mjs";
import { countTokens } from "./count-tokens.mjs";
import { evaluateScenario } from "./evaluate-scenario.mjs";
import { assertSupportedMode, getScenarioDefinition } from "./scenarios.mjs";
import { summarizeResults } from "./summarize-results.mjs";

function parseArguments(argv) {
  const scenario = argv[0];
  let mode;
  let runDir;

  for (let index = 1; index < argv.length; index += 1) {
    if (argv[index] === "--mode") {
      mode = argv[index + 1];
      index += 1;
      continue;
    }
    if (argv[index] === "--run-dir") {
      runDir = argv[index + 1];
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${argv[index]}`);
  }

  if (!scenario || !mode) {
    throw new Error(
      "Usage: node benchmarks/scripts/run-scenario.mjs <scenario> --mode <mode> [--run-dir <path>]",
    );
  }

  getScenarioDefinition(scenario);
  assertSupportedMode(mode);
  return { scenario, mode, runDir };
}

function defaultDevDeckBin() {
  return `node ${quote(cliDistPath)}`;
}

async function ensureCliBuilt() {
  if (!(await fileExists(cliDistPath))) {
    await runCommand("npm run build --workspace @hemangdoshi/devdeck", { cwd: repoRoot });
  }
}

function scenarioEnvironment(scenario) {
  if (scenario === "noisy-worker") {
    return {
      NOISY_WORKER: "1",
      WORKER_LOG_INTERVAL_MS: "500",
      WORKER_WARN_EVERY: "5",
    };
  }
  if (scenario === "api-crash") {
    return {
      API_FAIL_AFTER_MS: "5000",
      API_FAIL_MESSAGE: "database connection lost",
    };
  }
  return {};
}

function formatEnvironmentCommand(env, command) {
  const assignments = Object.entries(env)
    .map(([key, value]) => `${key}=${quote(value)}`)
    .join(" ");
  return assignments ? `${assignments} ${command}` : command;
}

function createRecorder({ mode, scenario, transcriptPath, events, commands }) {
  return async function record({
    id,
    commandLabel,
    command = commandLabel,
    category,
    output,
    startedAt,
    exitCode = 0,
  }) {
    commands.push(commandLabel);
    return await recordCommandEvent({
      events,
      transcriptPath,
      id,
      mode,
      scenario,
      commandLabel,
      command,
      category,
      output: output || "(no output)",
      startedAt: startedAt ?? new Date().toISOString(),
      endedAt: new Date().toISOString(),
      exitCode,
    });
  };
}

async function recordSleep(record, milliseconds, id) {
  const startedAt = new Date().toISOString();
  await sleep(milliseconds);
  await record({
    id,
    commandLabel: `sleep ${milliseconds / 1000}`,
    category: "manual-inspection",
    output: `waited ${milliseconds}ms`,
    startedAt,
  });
}

async function readMatchingLines(filePath, pattern) {
  const source = await readFile(filePath, "utf8");
  return source
    .split("\n")
    .filter((line) => line.toLowerCase().includes(pattern.toLowerCase()))
    .join("\n");
}

async function runBaselineMode(context) {
  const {
    scenario,
    fixtureDir,
    modeDir,
    transcriptPath,
    events,
    commands,
    observations,
  } = context;
  const record = createRecorder({
    mode: "baseline",
    scenario,
    transcriptPath,
    events,
    commands,
  });
  const apiLogPath = path.join(modeDir, "api.log");
  const workerLogPath = path.join(modeDir, "worker.log");
  const env = scenarioEnvironment(scenario);
  const handles = [];

  async function startService(name, serviceEnv = env, label = `npm run ${name}`) {
    const startedAt = new Date().toISOString();
    const logPath = name === "api" ? apiLogPath : workerLogPath;
    const handle = spawnLoggedProcess("npm", ["run", name], {
      cwd: fixtureDir,
      stdoutPath: logPath,
      env: serviceEnv,
    });
    handles.push({ name, handle });
    await record({
      id: `baseline-${scenario}-start-${name}-${handles.length}`,
      commandLabel: label,
      command: formatEnvironmentCommand(serviceEnv, label),
      category: "startup",
      output: `spawned pid ${handle.child.pid}`,
      startedAt,
    });
    return handle;
  }

  async function healthCheck(id, allowFailure = false) {
    const commandLabel = "curl --silent --show-error http://127.0.0.1:3100/health";
    const startedAt = new Date().toISOString();
    const result = await runCommand(commandLabel, {
      cwd: fixtureDir,
      allowFailure: true,
    });
    await record({
      id,
      commandLabel,
      category: "health-check",
      output: result.combined,
      startedAt,
      exitCode: result.code,
    });
    if (!allowFailure && result.code !== 0) {
      throw new Error(`Health check failed: ${result.combined.trim()}`);
    }
  }

  async function inspectProcesses(apiHandle, workerHandle, id) {
    const pids = [apiHandle?.child.pid, workerHandle?.child.pid].filter(Boolean).join(",");
    const commandLabel = `ps -p ${pids} -o pid=,state=,command=`;
    const startedAt = new Date().toISOString();
    const result = await runCommand(commandLabel, { allowFailure: true });
    await record({
      id,
      commandLabel,
      category: "process-management",
      output: result.combined,
      startedAt,
      exitCode: result.code,
    });
  }

  async function inspectLog(filePath, lines, id, label = path.basename(filePath)) {
    const startedAt = new Date().toISOString();
    const output = await tailFile(filePath, lines);
    await record({
      id,
      commandLabel: `tail -n ${lines} ${label}`,
      command: `tail -n ${lines} ${filePath}`,
      category: "logs",
      output,
      startedAt,
    });
  }

  async function grepLog(filePath, pattern, id, label = path.basename(filePath)) {
    const startedAt = new Date().toISOString();
    const output = await readMatchingLines(filePath, pattern);
    await record({
      id,
      commandLabel: `grep -i ${pattern} ${label}`,
      command: `grep -i ${quote(pattern)} ${filePath}`,
      category: "logs",
      output: output || "(no matches)",
      startedAt,
      exitCode: output ? 0 : 1,
    });
  }

  async function stopService(handle, name, id, category = "cleanup") {
    const startedAt = new Date().toISOString();
    await stopProcess(handle.child, name);
    await handle.closeStreams();
    await record({
      id,
      commandLabel: `kill ${handle.child.pid}`,
      category,
      output: handle.child.exitCode === null ? "sent SIGTERM" : `process exited ${handle.child.exitCode}`,
      startedAt,
    });
  }

  try {
    const api = await startService("api");
    const worker = await startService("worker");
    await waitForHttp("http://127.0.0.1:3100/health");
    await healthCheck(`baseline-${scenario}-health-initial`);

    if (scenario === "happy-path") {
      await inspectProcesses(api, worker, "baseline-happy-path-ps");
      await recordSleep(record, 4500, "baseline-happy-path-wait");
      await inspectLog(apiLogPath, 20, "baseline-happy-path-api-tail", "api.log");
      await inspectLog(workerLogPath, 20, "baseline-happy-path-worker-tail", "worker.log");
      await stopService(api, "api", "baseline-happy-path-stop-api", "process-management");
      const restartedApi = await startService("api", {}, "npm run api");
      observations.push("api restarted manually");
      await waitForHttp("http://127.0.0.1:3100/health");
      await healthCheck("baseline-happy-path-health-after-restart");
      await stopService(restartedApi, "api", "baseline-happy-path-cleanup-api");
      await stopService(worker, "worker", "baseline-happy-path-cleanup-worker");
    } else if (scenario === "noisy-worker") {
      await recordSleep(record, 6500, "baseline-noisy-worker-wait");
      await inspectLog(workerLogPath, 80, "baseline-noisy-worker-tail", "worker.log");
      await grepLog(workerLogPath, "warning", "baseline-noisy-worker-grep", "worker.log");
      await inspectLog(apiLogPath, 80, "baseline-noisy-worker-api-tail", "api.log");
      await inspectProcesses(api, worker, "baseline-noisy-worker-ps");
      await stopService(api, "api", "baseline-noisy-worker-cleanup-api");
      await stopService(worker, "worker", "baseline-noisy-worker-cleanup-worker");
    } else {
      await recordSleep(record, 6000, "baseline-api-crash-wait");
      await healthCheck("baseline-api-crash-health-failed", true);
      await inspectProcesses(api, worker, "baseline-api-crash-ps");
      await inspectLog(apiLogPath, 80, "baseline-api-crash-tail", "api.log");
      await grepLog(apiLogPath, "error", "baseline-api-crash-grep", "api.log");
      await stopService(api, "api", "baseline-api-crash-observe-exit", "process-management");
      const restartedApi = await startService("api", {}, "npm run api");
      observations.push("failed api identified and restarted manually");
      await waitForHttp("http://127.0.0.1:3100/health");
      await healthCheck("baseline-api-crash-health-after-restart");
      await stopService(restartedApi, "api", "baseline-api-crash-cleanup-api");
      await stopService(worker, "worker", "baseline-api-crash-cleanup-worker");
    }

    return { apiLogPath, workerLogPath };
  } catch (error) {
    for (const { name, handle } of handles) {
      await stopProcess(handle.child, name).catch(() => {});
      await handle.closeStreams().catch(() => {});
    }
    throw error;
  }
}

function devDeckSteps(scenario, mode) {
  if (mode === "devdeck-status-only") {
    return scenario === "api-crash"
      ? ["start", "status --json", "sleep:6000", "status --json", "service restart api", "status --json", "stop"]
      : ["start", "status --json", "service restart api", "status --json", "stop"];
  }
  if (mode === "devdeck-snapshot-only") {
    const wait = scenario === "noisy-worker" ? ["sleep:6500"] : [];
    return ["start", ...wait, "snapshot", "service restart api", "snapshot", "stop"];
  }
  if (mode === "devdeck-logs-only") {
    const wait = scenario === "noisy-worker" ? ["sleep:6500"] : [];
    return [
      "start",
      ...wait,
      "logs api --tail 20",
      "logs worker --tail 20",
      "service restart api",
      "logs api --tail 20",
      "stop",
    ];
  }
  if (scenario === "noisy-worker") {
    return [
      "start",
      "status --json",
      "sleep:6500",
      "logs worker --tail 30 --grep warning",
      "logs api --tail 20",
      "snapshot",
      "stop",
    ];
  }
  if (scenario === "api-crash") {
    return [
      "start",
      "status --json",
      "sleep:6000",
      "status --json",
      "logs api --tail 40 --severity error",
      "service restart api",
      "status --json",
      "stop",
    ];
  }
  return [
    "start",
    "status --json",
    "logs api --tail 80",
    "logs worker --tail 80",
    "snapshot",
    "service restart api",
    "stop",
  ];
}

function devDeckCategory(step) {
  if (step === "start") return "startup";
  if (step.startsWith("status")) return "state";
  if (step.startsWith("logs")) return "logs";
  if (step.startsWith("snapshot")) return "snapshot";
  if (step.startsWith("service")) return "control";
  if (step === "stop") return "cleanup";
  return "manual-inspection";
}

async function runDevDeckMode(context) {
  const {
    scenario,
    mode,
    fixtureDir,
    modeDir,
    transcriptPath,
    events,
    commands,
    observations,
  } = context;
  await ensureCliBuilt();
  const devdeckBin = process.env.DEVDECK_BIN ?? defaultDevDeckBin();
  const env = scenarioEnvironment(scenario);
  const record = createRecorder({ mode, scenario, transcriptPath, events, commands });
  const baseCommand = (suffix) => `${devdeckBin} ${suffix}`;

  await runCommand(baseCommand("stop --json"), {
    cwd: fixtureDir,
    allowFailure: true,
  });

  try {
    let sequence = 0;
    for (const step of devDeckSteps(scenario, mode)) {
      sequence += 1;
      if (step.startsWith("sleep:")) {
        await recordSleep(record, Number(step.split(":")[1]), `${mode}-${scenario}-${sequence}-wait`);
        continue;
      }

      const command = baseCommand(step);
      const startedAt = new Date().toISOString();
      const result = await runCommand(command, {
        cwd: fixtureDir,
        env: step === "start" ? env : undefined,
        allowFailure: true,
      });
      await record({
        id: `${mode}-${scenario}-${sequence}-${step.split(" ")[0]}`,
        commandLabel: `devdeck ${step}`,
        command: step === "start" ? formatEnvironmentCommand(env, command) : command,
        category: devDeckCategory(step),
        output: result.combined,
        startedAt,
        exitCode: result.code,
      });
      if (result.code !== 0) {
        throw new Error(`Command failed (${result.code}): ${command}\n${result.combined.trim()}`);
      }

      const artifactName = step.startsWith("status")
        ? `status-${sequence}.json`
        : step.startsWith("logs")
          ? `logs-${sequence}.txt`
          : step.startsWith("snapshot")
            ? `snapshot-${sequence}.md`
            : undefined;
      if (artifactName) {
        await writeFile(path.join(modeDir, artifactName), result.stdout || result.stderr, "utf8");
      }
    }
    observations.push(`${mode} scenario sequence completed`);
    return { devdeckBin };
  } catch (error) {
    await runCommand(baseCommand("stop --json"), {
      cwd: fixtureDir,
      allowFailure: true,
    }).catch(() => {});
    throw error;
  }
}

export async function runScenario({ scenario, mode, runDir } = {}) {
  const definition = getScenarioDefinition(scenario);
  assertSupportedMode(mode);
  const resolvedRunDir = await createRunDirectory(runDir);
  const modeDir = path.join(resolvedRunDir, mode);
  const fixture = "node-api-worker";
  const fixtureDir = getFixtureDirectory(fixture);
  const transcriptPath = path.join(modeDir, "transcript.txt");
  const runJsonPath = path.join(modeDir, "run.json");
  const events = [];
  const commands = [];
  const observations = [];
  const startedAt = new Date().toISOString();

  await ensureEmptyDirectory(modeDir);
  const existingScenarioPath = path.join(resolvedRunDir, "scenario.json");
  if (await fileExists(existingScenarioPath)) {
    const existing = JSON.parse(await readFile(existingScenarioPath, "utf8"));
    if (existing.scenario !== scenario) {
      throw new Error(
        `Run directory already contains scenario '${existing.scenario}', not '${scenario}'.`,
      );
    }
  } else {
    await writeJson(existingScenarioPath, {
      scenario,
      fixture,
      description: definition.description,
      measures: definition.measures,
      expected: definition.expected,
      createdAt: startedAt,
    });
  }

  let modeOutputs = {};
  let exitCode = 0;
  let failure;
  try {
    modeOutputs = mode === "baseline"
      ? await runBaselineMode({
          scenario,
          mode,
          fixtureDir,
          modeDir,
          transcriptPath,
          events,
          commands,
          observations,
        })
      : await runDevDeckMode({
          scenario,
          mode,
          fixtureDir,
          modeDir,
          transcriptPath,
          events,
          commands,
          observations,
        });
  } catch (error) {
    exitCode = 1;
    failure = error;
  }

  const environment = {
    ...getEnvironmentSummary(),
    ...(modeOutputs.devdeckBin
      ? {
          devdeckVersion: JSON.parse(
            await readFile(path.join(repoRoot, "packages/cli/package.json"), "utf8"),
          ).version,
          bin: modeOutputs.devdeckBin,
        }
      : {}),
  };
  await writeCommandEvents(modeDir, events);
  await writeJson(runJsonPath, {
    mode,
    scenario,
    fixture,
    startedAt,
    endedAt: new Date().toISOString(),
    commands,
    observations,
    exitCode,
    ...(failure ? { error: failure instanceof Error ? failure.message : String(failure) } : {}),
    environment,
    outputs: {
      transcript: transcriptPath,
      commandEvents: path.join(modeDir, "command-events.json"),
      ...modeOutputs,
    },
  });

  await countTokens(resolvedRunDir);
  await evaluateScenario(resolvedRunDir, mode);
  await summarizeResults(resolvedRunDir);

  if (failure) {
    throw failure;
  }
  return { runDir: resolvedRunDir, modeDir, runJsonPath };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await runScenario(parseArguments(process.argv.slice(2)));
  process.stdout.write(`${result.runDir}\n`);
}
