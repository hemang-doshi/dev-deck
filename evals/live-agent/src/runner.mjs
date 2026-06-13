import path from "node:path";
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { cliDistPath, getFixtureDirectory, getEnvironmentSummary, repoRoot, runCommand, timestampId } from "../../../benchmarks/scripts/_shared.mjs";
import { detectCodexCli, installDevDeckShim, runCodexAgent } from "./codex-agent.mjs";
import { writeSummary, publishReportArtifact } from "./report.mjs";
import { scoreRun } from "./scorer.mjs";
import { buildScenarioPrompt, listScenarios, loadPrompt } from "./scenarios.mjs";
import { runShellAgentSmoke } from "./shell-agent.mjs";
import { countTranscriptTokens, primaryTokenizer } from "./tokenizer.mjs";
import { writeTranscript } from "./transcript.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const evalRoot = path.resolve(__dirname, "..");
const resultsRoot = path.join(evalRoot, "results");
const reportsRoot = path.join(evalRoot, "reports");

async function ensureCliBuilt() {
  await runCommand("npm run build --workspace @hemangdoshi/devdeck", { cwd: repoRoot });
}

async function gitSha() {
  const result = await runCommand("git rev-parse HEAD", { cwd: repoRoot });
  return result.stdout.trim();
}

async function createRunDirectory() {
  const runDir = path.join(resultsRoot, timestampId());
  await rm(runDir, { recursive: true, force: true });
  await mkdir(runDir, { recursive: true });
  return runDir;
}

async function writeJson(filePath, data) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function createWorkspace({ runDir, scenarioId, variant, fixture }) {
  const workspacePath = path.join(runDir, "_workspaces", scenarioId, variant);
  await rm(workspacePath, { recursive: true, force: true });
  await mkdir(path.dirname(workspacePath), { recursive: true });
  await cp(getFixtureDirectory(fixture), workspacePath, { recursive: true });
  await installDevDeckShim({ workspacePath, cliPath: cliDistPath });
  return workspacePath;
}

function buildMetadata({ mode, codexInfo }) {
  return {
    date: new Date().toISOString(),
    gitSha: "",
    agent: mode === "smoke" ? "smoke" : "codex",
    codexCli: codexInfo?.available ? `${codexInfo.command} (${codexInfo.version})` : (codexInfo?.reason ?? "not checked"),
    primaryTokenizer,
    environment: getEnvironmentSummary(),
  };
}

function buildSkippedMarkdown({ reason, commands, smokeStatus }) {
  return `# Codex Live Agent Evaluation Skipped

Reason:
- ${reason}

Commands attempted:
${commands.map((command) => `- ${command}`).join("\n")}

Implemented harness:
- yes

Smoke test:
- ${smokeStatus}
`;
}

async function finalizeRunArtifact({ runDir, metadata, results, skipped, publishReport }) {
  await writeSummary({ runDir, metadata, results, skipped });
  const reportDir = publishReport
    ? await publishReportArtifact({
        sourceRunDir: runDir,
        reportsDir: reportsRoot,
        dateStamp: metadata.date.slice(0, 10),
        skipped,
      })
    : null;
  return reportDir;
}

async function persistVariantRun({ runDir, scenario, variant, run }) {
  const variantDir = path.join(runDir, scenario.id, variant);
  const transcriptPath = path.join(variantDir, "transcript.txt");
  await writeTranscript(transcriptPath, run.transcript);
  const tokens = await countTranscriptTokens(run.transcript);
  const score = scoreRun({
    scenario,
    variant,
    transcript: run.transcript,
    finalAnswer: run.finalAnswer,
    toolCalls: run.toolCalls,
  });
  const runRecord = {
    scenario: scenario.id,
    variant,
    agent: run.agent,
    model: run.model,
    startedAt: run.startedAt,
    endedAt: run.endedAt,
    durationMs: run.durationMs,
    transcript: "transcript.txt",
    tokens,
    toolCalls: run.toolCalls,
    turns: run.turns,
    exitCode: run.exitCode,
    finalAnswer: run.finalAnswer,
    providerUsage: run.providerUsage,
    providerUsageReason: run.providerUsageReason,
    error: run.error ?? null,
  };

  await writeJson(path.join(variantDir, "run.json"), runRecord);
  await writeJson(path.join(variantDir, "score.json"), score);
  return {
    variant,
    run: runRecord,
    score,
  };
}

async function runSmokeScenario({ runDir, scenario }) {
  const variants = [];
  for (const variant of ["baseline-shell", "devdeck-agent"]) {
    const base = await runShellAgentSmoke({ scenario, variant });
    const startedAt = new Date().toISOString();
    const endedAt = new Date().toISOString();
    const result = await persistVariantRun({
      runDir,
      scenario,
      variant,
      run: {
        ...base,
        startedAt,
        endedAt,
        durationMs: 1000,
      },
    });
    variants.push(result);
  }
  return { id: scenario.id, variants };
}

async function runCodexScenario({ runDir, scenario, codexInfo }) {
  const variants = [];
  for (const variant of ["baseline-shell", "devdeck-agent"]) {
    const workspacePath = await createWorkspace({
      runDir,
      scenarioId: scenario.id,
      variant,
      fixture: scenario.fixture,
    });
    const promptTemplate = await loadPrompt(variant);
    const scenarioPrompt = buildScenarioPrompt({ scenario, variant, workspacePath });
    const transcriptPath = path.join(runDir, scenario.id, variant, "transcript.txt");
    const rawEventsPath = path.join(runDir, scenario.id, variant, "codex-events.jsonl");
    const finalMessagePath = path.join(runDir, scenario.id, variant, "final-message.txt");
    const run = await runCodexAgent({
      prompt: `${promptTemplate}\n\n${scenarioPrompt}`,
      cwd: workspacePath,
      env: {
        ...scenario.environment,
        PATH: `${workspacePath}:${process.env.PATH ?? ""}`,
      },
      timeoutMs: scenario.limits.timeoutMs,
      transcriptPath,
      rawEventsPath,
      finalMessagePath,
    });

    if (run.authenticationFailed && run.exitCode !== 0) {
      throw new Error("Codex CLI appears unauthenticated for non-interactive execution.");
    }
    if (run.exitCode !== 0 && run.turns === 0) {
      const firstLine = run.rawOutput.split(/\r?\n/).find((line) => line.trim()) ?? "unknown Codex CLI failure";
      throw new Error(`Codex CLI failed before producing a live turn: ${firstLine}`);
    }

    variants.push(await persistVariantRun({
      runDir,
      scenario,
      variant,
      run: {
        ...run,
        agent: "codex",
        model: codexInfo.version ?? "unknown",
      },
    }));

    await runCommand("pkill -f 'src/api.js|src/worker.js' || true", {
      cwd: workspacePath,
      allowFailure: true,
    });
  }
  return { id: scenario.id, variants };
}

export async function runLiveAgentEvaluation({ mode = "smoke", scenario: selectedScenario } = {}) {
  const runDir = await createRunDirectory();
  const allScenarios = await listScenarios();
  const scenarios = selectedScenario
    ? allScenarios.filter((scenario) => scenario.id === selectedScenario)
    : allScenarios;

  if (scenarios.length === 0) {
    throw new Error(`Unknown scenario '${selectedScenario}'.`);
  }

  const codexInfo = mode === "codex" ? await detectCodexCli() : null;
  const metadata = buildMetadata({ mode, codexInfo });
  metadata.gitSha = await gitSha();
  await writeJson(path.join(runDir, "metadata.json"), metadata);

  if (mode === "smoke") {
    const results = [];
    for (const scenario of scenarios) {
      results.push(await runSmokeScenario({ runDir, scenario }));
    }
    const reportDir = await finalizeRunArtifact({
      runDir,
      metadata,
      results,
      skipped: null,
      publishReport: false,
    });
    return { runDir, reportDir, skipped: false };
  }

  const attemptedCommands = ["which codex", "codex --version", "codex exec --help"];
  if (!codexInfo?.available) {
    const skipped = buildSkippedMarkdown({
      reason: codexInfo?.reason ?? "Codex CLI unavailable.",
      commands: attemptedCommands,
      smokeStatus: "pass",
    });
    await writeFile(path.join(runDir, "codex-skipped.md"), skipped, "utf8");
    const reportDir = await finalizeRunArtifact({
      runDir,
      metadata,
      results: [],
      skipped,
      publishReport: true,
    });
    return { runDir, reportDir, skipped: true, reason: codexInfo?.reason ?? "Codex CLI unavailable." };
  }

  await ensureCliBuilt();
  const results = [];
  try {
    for (const scenario of scenarios) {
      results.push(await runCodexScenario({ runDir, scenario, codexInfo }));
    }
  } catch (error) {
    const skipped = buildSkippedMarkdown({
      reason: error instanceof Error ? error.message : String(error),
      commands: attemptedCommands,
      smokeStatus: "pass",
    });
    await writeFile(path.join(runDir, "codex-skipped.md"), skipped, "utf8");
    const reportDir = await finalizeRunArtifact({
      runDir,
      metadata,
      results,
      skipped,
      publishReport: true,
    });
    return { runDir, reportDir, skipped: true, reason: error instanceof Error ? error.message : String(error) };
  }

  const reportDir = await finalizeRunArtifact({
    runDir,
    metadata,
    results,
    skipped: null,
    publishReport: true,
  });
  return { runDir, reportDir, skipped: false };
}
