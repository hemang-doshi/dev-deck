import path from "node:path";

import {
  createRunDirectory,
  ensureEmptyDirectory,
  getEnvironmentSummary,
  getFixtureDirectory,
  parseRunDirArgument,
  recordCommandEvent,
  runCommand,
  sleep,
  spawnLoggedProcess,
  stopProcess,
  tailFile,
  waitForHttp,
  writeCommandEvents,
  writeJson,
} from "./_shared.mjs";

export async function runBaseline({ runDir, fixture = "node-api-worker" } = {}) {
  const resolvedRunDir = await createRunDirectory(runDir);
  const baselineDir = path.join(resolvedRunDir, "baseline");
  const fixtureDir = getFixtureDirectory(fixture);
  const transcriptPath = path.join(baselineDir, "transcript.txt");
  const apiLogPath = path.join(baselineDir, "api.log");
  const workerLogPath = path.join(baselineDir, "worker.log");
  const runJsonPath = path.join(baselineDir, "run.json");
  const commands = [];
  const commandEvents = [];
  const observations = [];
  const startedAt = new Date().toISOString();

  await ensureEmptyDirectory(baselineDir);

  const apiStartedAt = new Date().toISOString();
  const apiHandle = spawnLoggedProcess("npm", ["run", "api"], {
    cwd: fixtureDir,
    stdoutPath: apiLogPath,
  });
  commands.push("npm run api");
  await recordCommandEvent({
    events: commandEvents,
    transcriptPath,
    id: "baseline-start-api",
    mode: "baseline",
    scenario: "happy-path",
    commandLabel: "npm run api",
    command: "npm run api",
    category: "startup",
    output: `spawned pid ${apiHandle.child.pid}`,
    startedAt: apiStartedAt,
    endedAt: new Date().toISOString(),
    exitCode: 0,
  });

  const workerStartedAt = new Date().toISOString();
  const workerHandle = spawnLoggedProcess("npm", ["run", "worker"], {
    cwd: fixtureDir,
    stdoutPath: workerLogPath,
  });
  commands.push("npm run worker");
  await recordCommandEvent({
    events: commandEvents,
    transcriptPath,
    id: "baseline-start-worker",
    mode: "baseline",
    scenario: "happy-path",
    commandLabel: "npm run worker",
    command: "npm run worker",
    category: "startup",
    output: `spawned pid ${workerHandle.child.pid}`,
    startedAt: workerStartedAt,
    endedAt: new Date().toISOString(),
    exitCode: 0,
  });

  try {
    const healthStartedAt = new Date().toISOString();
    const health = await waitForHttp("http://127.0.0.1:3100/health");
    observations.push("api health endpoint responded");
    commands.push("curl http://127.0.0.1:3100/health");
    await recordCommandEvent({
      events: commandEvents,
      transcriptPath,
      id: "baseline-health-check",
      mode: "baseline",
      scenario: "happy-path",
      commandLabel: "curl http://127.0.0.1:3100/health",
      command: "curl http://127.0.0.1:3100/health",
      category: "health-check",
      output: `HTTP ${health.status}\n${health.body}`,
      startedAt: healthStartedAt,
      endedAt: new Date().toISOString(),
      exitCode: 0,
    });

    const psCommand = `ps -p ${apiHandle.child.pid},${workerHandle.child.pid} -o pid=,state=,command=`;
    const psStartedAt = new Date().toISOString();
    const ps = await runCommand(psCommand, { allowFailure: true });
    commands.push(psCommand);
    observations.push("manual process inspection completed");
    await recordCommandEvent({
      events: commandEvents,
      transcriptPath,
      id: "baseline-process-inspection",
      mode: "baseline",
      scenario: "happy-path",
      commandLabel: psCommand,
      command: psCommand,
      category: "manual-inspection",
      output: ps.combined || "(no output)",
      startedAt: psStartedAt,
      endedAt: new Date().toISOString(),
      exitCode: ps.code,
    });
    if (ps.code !== 0) {
      throw new Error(`Command failed (${ps.code}): ${psCommand}\n${ps.combined.trim()}`);
    }

    await sleep(4500);

    const apiTailStartedAt = new Date().toISOString();
    const apiTail = await tailFile(apiLogPath, 20);
    commands.push("tail -n 20 baseline/api.log");
    observations.push("read api log tail");
    await recordCommandEvent({
      events: commandEvents,
      transcriptPath,
      id: "baseline-api-log-tail",
      mode: "baseline",
      scenario: "happy-path",
      commandLabel: "tail -n 20 api.log",
      command: `tail -n 20 ${apiLogPath}`,
      category: "logs",
      output: apiTail,
      startedAt: apiTailStartedAt,
      endedAt: new Date().toISOString(),
      exitCode: 0,
    });

    const workerTailStartedAt = new Date().toISOString();
    const workerTail = await tailFile(workerLogPath, 20);
    commands.push("tail -n 20 baseline/worker.log");
    observations.push("read worker log tail");
    await recordCommandEvent({
      events: commandEvents,
      transcriptPath,
      id: "baseline-worker-log-tail",
      mode: "baseline",
      scenario: "happy-path",
      commandLabel: "tail -n 20 worker.log",
      command: `tail -n 20 ${workerLogPath}`,
      category: "logs",
      output: workerTail,
      startedAt: workerTailStartedAt,
      endedAt: new Date().toISOString(),
      exitCode: 0,
    });

    const stopApiStartedAt = new Date().toISOString();
    await stopProcess(apiHandle.child, "api");
    await apiHandle.closeStreams();
    commands.push(`kill ${apiHandle.child.pid}`);
    observations.push("restarted api manually");
    await recordCommandEvent({
      events: commandEvents,
      transcriptPath,
      id: "baseline-stop-api-for-restart",
      mode: "baseline",
      scenario: "happy-path",
      commandLabel: `kill ${apiHandle.child.pid}`,
      command: `kill ${apiHandle.child.pid}`,
      category: "process-management",
      output: "sent SIGTERM",
      startedAt: stopApiStartedAt,
      endedAt: new Date().toISOString(),
      exitCode: 0,
    });

    const restartApiStartedAt = new Date().toISOString();
    const restartedApiHandle = spawnLoggedProcess("npm", ["run", "api"], {
      cwd: fixtureDir,
      stdoutPath: apiLogPath,
    });
    commands.push("npm run api");
    await recordCommandEvent({
      events: commandEvents,
      transcriptPath,
      id: "baseline-restart-api",
      mode: "baseline",
      scenario: "happy-path",
      commandLabel: "npm run api",
      command: "npm run api",
      category: "process-management",
      output: `respawned pid ${restartedApiHandle.child.pid}`,
      startedAt: restartApiStartedAt,
      endedAt: new Date().toISOString(),
      exitCode: 0,
    });

    const secondHealthStartedAt = new Date().toISOString();
    const secondHealth = await waitForHttp("http://127.0.0.1:3100/health");
    commands.push("curl http://127.0.0.1:3100/health");
    await recordCommandEvent({
      events: commandEvents,
      transcriptPath,
      id: "baseline-health-check-after-restart",
      mode: "baseline",
      scenario: "happy-path",
      commandLabel: "curl http://127.0.0.1:3100/health",
      command: "curl http://127.0.0.1:3100/health",
      category: "health-check",
      output: `HTTP ${secondHealth.status}\n${secondHealth.body}`,
      startedAt: secondHealthStartedAt,
      endedAt: new Date().toISOString(),
      exitCode: 0,
    });

    await stopProcess(restartedApiHandle.child, "api");
    await stopProcess(workerHandle.child, "worker");
    await restartedApiHandle.closeStreams();
    await workerHandle.closeStreams();

    const runData = {
      mode: "baseline",
      fixture,
      startedAt,
      endedAt: new Date().toISOString(),
      commands,
      observations,
      exitCode: 0,
      environment: getEnvironmentSummary(),
      outputs: {
        transcript: transcriptPath,
        apiLog: apiLogPath,
        workerLog: workerLogPath,
      },
    };

    await writeCommandEvents(baselineDir, commandEvents);
    await writeJson(runJsonPath, runData);
    return { runDir: resolvedRunDir, baselineDir, runJsonPath };
  } catch (error) {
    await stopProcess(apiHandle.child, "api").catch(() => {});
    await stopProcess(workerHandle.child, "worker").catch(() => {});
    await apiHandle.closeStreams();
    await workerHandle.closeStreams();

    const runData = {
      mode: "baseline",
      fixture,
      startedAt,
      endedAt: new Date().toISOString(),
      commands,
      observations,
      exitCode: 1,
      error: error instanceof Error ? error.message : String(error),
      environment: getEnvironmentSummary(),
    };

    await writeCommandEvents(baselineDir, commandEvents);
    await writeJson(runJsonPath, runData);
    throw error;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const runDir = parseRunDirArgument(process.argv.slice(2));
  const result = await runBaseline({ runDir });
  process.stdout.write(`${result.runDir}\n`);
}
