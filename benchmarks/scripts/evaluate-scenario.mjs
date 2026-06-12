import path from "node:path";
import { readFile, readdir } from "node:fs/promises";

import {
  fileExists,
  listRunModes,
  parseRunDirArgument,
  readJson,
  writeJson,
} from "./_shared.mjs";
import { getScenarioDefinition } from "./scenarios.mjs";

async function readModeCorpus(modeDir) {
  const entries = await readdir(modeDir, { withFileTypes: true });
  const sources = [];

  for (const entry of entries) {
    if (
      entry.isFile() &&
      entry.name !== "evaluation.json" &&
      /\.(json|log|md|txt)$/i.test(entry.name)
    ) {
      sources.push(await readFile(path.join(modeDir, entry.name), "utf8"));
    }
  }

  return sources.join("\n").toLowerCase();
}

function includesRecoveryAction(corpus, action) {
  if (!action) return true;
  const [verb, service] = action.toLowerCase().split(/\s+/, 2);
  return corpus.includes(action.toLowerCase()) ||
    corpus.includes(`${service} ${verb}`) ||
    new RegExp(`${verb}(?:ed|ing)?[^\\n]{0,40}${service}`, "i").test(corpus) ||
    new RegExp(`${service}[^\\n]{0,40}${verb}(?:ed|ing)?`, "i").test(corpus);
}

function hasHealthyEvidence(corpus, run) {
  if (run.exitCode !== 0 || run.error) return false;
  return /\b(running|healthy|health|http 200|state["']?\s*:\s*["']running)\b/i.test(corpus);
}

function countChecks(checks) {
  const values = Object.values(checks);
  const passedChecks = values.filter(Boolean).length;
  return {
    passed: passedChecks === values.length,
    passedChecks,
    totalChecks: values.length,
  };
}

export async function evaluateScenario(runDir, mode) {
  if (!runDir || !mode) {
    throw new Error(
      "Usage: node benchmarks/scripts/evaluate-scenario.mjs <run-dir> --mode <mode>",
    );
  }

  const scenarioRun = await readJson(path.join(runDir, "scenario.json"));
  const scenarioName = scenarioRun.scenario ?? scenarioRun.id;
  const definition = getScenarioDefinition(scenarioName);
  const modeDir = path.join(runDir, mode);
  const run = await readJson(path.join(modeDir, "run.json"));
  const corpus = await readModeCorpus(modeDir);
  let checks;

  if (scenarioName === "api-crash") {
    const failedService = definition.expected.failedService.toLowerCase();
    checks = {
      observedExpectedFailure:
        corpus.includes(failedService) &&
        /\b(crash|error|failed|exited|connection lost|unhealthy)\b/i.test(corpus),
      observedExpectedRootCause: corpus.includes(
        definition.expected.rootCauseContains.toLowerCase(),
      ),
      observedExpectedRecoveryAction: includesRecoveryAction(
        corpus,
        definition.expected.recoveryAction,
      ),
      observedFinalVerification:
        includesRecoveryAction(corpus, definition.expected.recoveryAction) &&
        hasHealthyEvidence(corpus, run),
    };
  } else if (scenarioName === "noisy-worker") {
    checks = {
      observedExpectedWarning: corpus.includes(
        definition.expected.warningContains.toLowerCase(),
      ),
      observedWarningDiscovery:
        /\b(grep|warning|severity|logs worker)\b/i.test(corpus),
      observedHealthyFinalState: hasHealthyEvidence(corpus, run),
    };
  } else {
    checks = {
      observedHealthyState: hasHealthyEvidence(corpus, run),
      observedExpectedRecoveryAction: includesRecoveryAction(
        corpus,
        definition.expected.recoveryAction,
      ),
      observedFinalVerification: hasHealthyEvidence(corpus, run),
    };
  }

  const evaluation = {
    scenario: scenarioName,
    mode,
    checks,
    score: countChecks(checks),
  };
  await writeJson(path.join(modeDir, "evaluation.json"), evaluation);
  await writeEvaluationSummary(runDir);
  return evaluation;
}

export async function writeEvaluationSummary(runDir) {
  const modes = await listRunModes(runDir);
  const evaluations = {};

  for (const mode of modes) {
    const evaluationPath = path.join(runDir, mode, "evaluation.json");
    if (await fileExists(evaluationPath)) {
      evaluations[mode] = await readJson(evaluationPath);
    }
  }

  const scenarioRun = await readJson(path.join(runDir, "scenario.json"));
  const summary = {
    scenario: scenarioRun.scenario ?? scenarioRun.id,
    passed: Object.values(evaluations).every((evaluation) => evaluation.score.passed),
    modes: evaluations,
  };
  await writeJson(path.join(runDir, "evaluation-summary.json"), summary);
  return summary;
}

function parseMode(argv) {
  const index = argv.indexOf("--mode");
  return index === -1 ? undefined : argv[index + 1];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);
  const runDir = parseRunDirArgument(argv);
  const evaluation = await evaluateScenario(
    runDir ? path.resolve(runDir) : undefined,
    parseMode(argv),
  );
  process.stdout.write(`${JSON.stringify(evaluation, null, 2)}\n`);
}
