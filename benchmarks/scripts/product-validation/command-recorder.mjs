import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";

import {
  ensureEmptyDirectory,
  getEnvironmentSummary,
  recordCommandEvent,
  runCommand,
  sleep,
  spawnLoggedProcess,
  stopProcess,
  tailFile,
  writeCommandEvents,
  writeJson,
} from "../_shared.mjs";
import { getScenarioRunDirectory, runtimeManagementCategories } from "./complex-fixture.mjs";

async function safeTail(filePath, lines = 40) {
  try {
    const tailed = await tailFile(filePath, lines);
    return tailed || "(no output)";
  } catch {
    return "(no output)";
  }
}

export class ProductValidationRecorder {
  constructor({ runRoot, scenario, mode, fixtureDir }) {
    this.runRoot = runRoot;
    this.scenario = scenario;
    this.mode = mode;
    this.fixtureDir = fixtureDir;
    this.modeDir = getScenarioRunDirectory(runRoot, scenario, mode);
    this.transcriptPath = path.join(this.modeDir, "transcript.txt");
    this.commandEventsPath = path.join(this.modeDir, "command-events.json");
    this.runJsonPath = path.join(this.modeDir, "run.json");
    this.evaluationPath = path.join(this.modeDir, "evaluation.json");
    this.serviceLogsDir = path.join(this.modeDir, "service-logs");
    this.events = [];
    this.serviceHandles = [];
    this.startedAt = new Date().toISOString();
  }

  async init() {
    await ensureEmptyDirectory(this.modeDir);
    await mkdir(this.serviceLogsDir, { recursive: true });
  }

  getServiceLogPath(serviceName) {
    return path.join(this.serviceLogsDir, `${serviceName}.log`);
  }

  async runObservedCommand({
    id,
    command,
    commandLabel = command,
    transcriptCommand = commandLabel,
    category,
    cwd = this.fixtureDir,
    allowFailure = false,
    saveOutputPath = null,
    recordTranscript = true,
    hidden = false,
    hiddenReason = null,
    startedAtOverride = null,
  }) {
    const startedAt = startedAtOverride ?? new Date().toISOString();
    const result = await runCommand(command, { cwd, allowFailure: true });
    const output = result.combined || "(no output)";

    await recordCommandEvent({
      events: this.events,
      transcriptPath: this.transcriptPath,
      recordTranscript,
      id,
      mode: this.mode,
      scenario: this.scenario,
      commandLabel,
      command,
      transcriptCommand,
      category,
      output,
      startedAt,
      endedAt: new Date().toISOString(),
      exitCode: result.code,
      hidden,
      hiddenReason,
    });

    if (saveOutputPath) {
      await writeFile(saveOutputPath, `${output.trimEnd()}\n`, "utf8");
    }

    if (!allowFailure && result.code !== 0) {
      throw new Error(`Command failed (${result.code}): ${command}\n${output.trim()}`);
    }

    return result;
  }

  async startLoggedService({
    id,
    serviceName,
    scriptName,
    category = "startup",
    previewDelayMs = 400,
  }) {
    const logPath = this.getServiceLogPath(serviceName);
    const startedAt = new Date().toISOString();
    const handle = spawnLoggedProcess("npm", ["run", scriptName], {
      cwd: this.fixtureDir,
      stdoutPath: logPath,
    });
    this.serviceHandles.push({ serviceName, handle, logPath });

    await sleep(previewDelayMs);
    const preview = await safeTail(logPath, 25);
    const output = [`spawned pid ${handle.child.pid}`, preview].join("\n").trimEnd();

    await recordCommandEvent({
      events: this.events,
      transcriptPath: this.transcriptPath,
      id,
      mode: this.mode,
      scenario: this.scenario,
      commandLabel: `npm run ${scriptName}`,
      command: `npm run ${scriptName}`,
      category,
      output,
      startedAt,
      endedAt: new Date().toISOString(),
      exitCode: 0,
    });

    return handle;
  }

  async captureManualServiceLog(serviceName, lines = 80, category = "logs") {
    const logPath = this.getServiceLogPath(serviceName);
    const output = await safeTail(logPath, lines);
    await recordCommandEvent({
      events: this.events,
      transcriptPath: this.transcriptPath,
      id: `${this.mode}-${serviceName}-log-tail-${this.events.length + 1}`,
      mode: this.mode,
      scenario: this.scenario,
      commandLabel: `tail -n ${lines} service-logs/${serviceName}.log`,
      command: `tail -n ${lines} ${logPath}`,
      category,
      output,
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      exitCode: 0,
    });
    return output;
  }

  async captureDevDeckServiceLog(serviceName, command, lines = 120) {
    const outputPath = this.getServiceLogPath(serviceName);
    const startedAt = new Date().toISOString();
    const result = await this.runObservedCommand({
      id: `${this.mode}-${serviceName}-devdeck-log-${this.events.length + 1}`,
      command,
      commandLabel: command.replace(/^node .*?dist\/index\.js/, "npx devdeck"),
      transcriptCommand: command.replace(/^node .*?dist\/index\.js/, "npx devdeck"),
      category: "hidden-evaluator",
      allowFailure: true,
      saveOutputPath: outputPath,
      recordTranscript: false,
      hidden: true,
      hiddenReason: "evaluator log artifact",
      startedAtOverride: startedAt,
    });
    return { output: result.combined || "(no output)", exitCode: result.code, lines };
  }

  async disposeServiceHandles() {
    for (const { serviceName, handle } of this.serviceHandles) {
      try {
        await stopProcess(handle.child, serviceName);
      } catch {
        // cleanup script is the primary stopper
      }
      await handle.closeStreams();
    }
  }

  buildMetrics() {
    const visibleEvents = this.events.filter((event) => event.hidden !== true);
    const transcriptCharacters = visibleEvents.reduce(
      (total, event) => total + (event.characters ?? 0),
      0,
    );
    const transcriptTokens = visibleEvents.reduce(
      (total, event) => total + (event.primaryTokens ?? event.approxTokens ?? 0),
      0,
    );
    const totalToolCalls = visibleEvents.length;
    const runtimeManagementToolCalls = visibleEvents.filter((event) =>
      runtimeManagementCategories.has(event.category)
    ).length;
    const hiddenEvaluatorCommands = this.events.filter((event) => event.hidden === true).length;
    const devdeckCommands = visibleEvents.filter((event) => /\bdevdeck\b|packages\/cli\/dist\/index\.js/.test(event.commandLabel ?? event.command ?? "")).length;
    const logInspectionCommands = visibleEvents.filter((event) => /\blogs\b|tail -n/.test(event.commandLabel ?? event.command ?? "")).length;
    const diagnoseCommands = visibleEvents.filter((event) => /\bdiagnose\b/.test(event.commandLabel ?? event.command ?? "")).length;
    const restartCommands = visibleEvents.filter((event) => /\brestart\b/.test(event.commandLabel ?? event.command ?? "")).length;
    const rawShellFallbackCommands = visibleEvents.filter((event) =>
      !/\bdevdeck\b|packages\/cli\/dist\/index\.js/.test(event.commandLabel ?? event.command ?? "")
    ).length;

    return {
      transcriptCharacters,
      transcriptTokens,
      totalToolCalls,
      runtimeManagementToolCalls,
      rawShellFallbackCommands,
      devdeckCommands,
      logInspectionCommands,
      diagnoseCommands,
      restartCommands,
      hiddenEvaluatorCommands,
    };
  }

  async finalize({ exitCode = 0, error = null, extra = {} } = {}) {
    await writeCommandEvents(this.modeDir, this.events);

    const completedAt = new Date().toISOString();
    const startedMs = new Date(this.startedAt).getTime();
    const endedMs = new Date(completedAt).getTime();
    const runData = {
      mode: this.mode,
      scenario: this.scenario,
      fixture: "complex-saas-stack",
      startedAt: this.startedAt,
      endedAt: completedAt,
      durationMs: endedMs - startedMs,
      exitCode,
      error,
      environment: getEnvironmentSummary(),
      outputs: {
        transcript: this.transcriptPath,
        commandEvents: this.commandEventsPath,
        serviceLogs: this.serviceLogsDir,
      },
      metrics: this.buildMetrics(),
      ...extra,
    };

    await writeJson(this.runJsonPath, runData);
    return runData;
  }
}
