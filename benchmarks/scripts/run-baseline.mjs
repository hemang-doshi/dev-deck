import path from "node:path";

import {
  appendTranscript,
  createRunDirectory,
  ensureEmptyDirectory,
  getEnvironmentSummary,
  getFixtureDirectory,
  parseRunDirArgument,
  runCommand,
  sleep,
  spawnLoggedProcess,
  stopProcess,
  tailFile,
  waitForHttp,
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
  const observations = [];
  const startedAt = new Date().toISOString();

  await ensureEmptyDirectory(baselineDir);

  const apiHandle = spawnLoggedProcess("npm", ["run", "api"], {
    cwd: fixtureDir,
    stdoutPath: apiLogPath,
  });
  commands.push("npm run api");
  await appendTranscript(transcriptPath, "npm run api", `spawned pid ${apiHandle.child.pid}`);

  const workerHandle = spawnLoggedProcess("npm", ["run", "worker"], {
    cwd: fixtureDir,
    stdoutPath: workerLogPath,
  });
  commands.push("npm run worker");
  await appendTranscript(transcriptPath, "npm run worker", `spawned pid ${workerHandle.child.pid}`);

  try {
    const health = await waitForHttp("http://127.0.0.1:3100/health");
    observations.push("api health endpoint responded");
    commands.push("curl http://127.0.0.1:3100/health");
    await appendTranscript(
      transcriptPath,
      "curl http://127.0.0.1:3100/health",
      `HTTP ${health.status}\n${health.body}`,
    );

    const ps = await runCommand(`ps -p ${apiHandle.child.pid},${workerHandle.child.pid} -o pid=,state=,command=`);
    commands.push(`ps -p ${apiHandle.child.pid},${workerHandle.child.pid} -o pid=,state=,command=`);
    observations.push("manual process inspection completed");
    await appendTranscript(transcriptPath, `ps -p ${apiHandle.child.pid},${workerHandle.child.pid} -o pid=,state=,command=`, ps.stdout);

    await sleep(4500);

    const apiTail = await tailFile(apiLogPath, 20);
    commands.push("tail -n 20 baseline/api.log");
    observations.push("read api log tail");
    await appendTranscript(transcriptPath, "tail -n 20 api.log", apiTail);

    const workerTail = await tailFile(workerLogPath, 20);
    commands.push("tail -n 20 baseline/worker.log");
    observations.push("read worker log tail");
    await appendTranscript(transcriptPath, "tail -n 20 worker.log", workerTail);

    await stopProcess(apiHandle.child, "api");
    await apiHandle.closeStreams();
    commands.push(`kill ${apiHandle.child.pid}`);
    observations.push("restarted api manually");
    await appendTranscript(transcriptPath, `kill ${apiHandle.child.pid}`, "sent SIGTERM");

    const restartedApiHandle = spawnLoggedProcess("npm", ["run", "api"], {
      cwd: fixtureDir,
      stdoutPath: apiLogPath,
    });
    commands.push("npm run api");
    await appendTranscript(transcriptPath, "npm run api", `respawned pid ${restartedApiHandle.child.pid}`);

    const secondHealth = await waitForHttp("http://127.0.0.1:3100/health");
    commands.push("curl http://127.0.0.1:3100/health");
    await appendTranscript(
      transcriptPath,
      "curl http://127.0.0.1:3100/health",
      `HTTP ${secondHealth.status}\n${secondHealth.body}`,
    );

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

    await writeJson(runJsonPath, runData);
    throw error;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const runDir = parseRunDirArgument(process.argv.slice(2));
  const result = await runBaseline({ runDir });
  process.stdout.write(`${result.runDir}\n`);
}
