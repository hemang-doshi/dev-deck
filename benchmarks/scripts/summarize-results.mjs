import path from "node:path";
import { writeFile } from "node:fs/promises";

import { fileExists, listRunModes, parseRunDirArgument, readJson } from "./_shared.mjs";

function tokenValues(tokens, mode) {
  const primary = tokens.tokenizers[tokens.primaryTokenizer].modes[mode];
  const approximate = tokens.tokenizers["approx-char-div-4"]?.modes[mode];
  return {
    characters: primary.characters,
    primaryTokens: primary.tokens,
    approxTokens: approximate?.tokens ?? null,
  };
}

function displayCount(value) {
  return value ?? "-";
}

function attributionRows(attribution, modes) {
  return modes.flatMap((mode) =>
    (attribution.modes[mode]?.commands ?? []).map(
      (event) =>
        `| ${mode} | ${event.commandLabel} | ${event.category} | ${event.primaryTokens} | ${displayCount(event.tokens["approx-char-div-4"])} |`,
    ),
  );
}

function evaluationRows(evaluationSummary, modes) {
  return modes.map((mode) => {
    const evaluation = evaluationSummary?.modes[mode];
    if (!evaluation) return `| ${mode} | no | 0/0 | evaluation missing |`;
    const failedChecks = Object.entries(evaluation.checks)
      .filter(([, passed]) => !passed)
      .map(([name]) => name);
    return `| ${mode} | ${evaluation.score.passed ? "yes" : "no"} | ${evaluation.score.passedChecks}/${evaluation.score.totalChecks} | ${failedChecks.length === 0 ? "all checks passed" : `failed: ${failedChecks.join(", ")}`} |`;
  });
}

export async function summarizeResults(runDir) {
  if (!runDir) {
    throw new Error("Usage: node benchmarks/scripts/summarize-results.mjs <results-dir>");
  }

  const scenarioPath = path.join(runDir, "scenario.json");
  if (await fileExists(scenarioPath)) {
    return await summarizeScenarioResults(runDir);
  }

  const baseline = await readJson(path.join(runDir, "baseline/run.json"));
  const devdeck = await readJson(path.join(runDir, "devdeck/run.json"));
  const tokens = await readJson(path.join(runDir, "token-count.json"));
  const attribution = await readJson(path.join(runDir, "command-attribution.json"));
  const modes = ["baseline", "devdeck"];
  const baselineTokens = tokenValues(tokens, "baseline");
  const devdeckTokens = tokenValues(tokens, "devdeck");

  const summary = [
    "# DevDeck Benchmark Run",
    "",
    "## Fixture",
    "",
    baseline.fixture,
    "",
    "## Environment",
    "",
    `- OS: ${baseline.environment.os}`,
    `- Node: ${baseline.environment.node}`,
    `- DevDeck: ${devdeck.environment.devdeckVersion ?? "unknown"}`,
    `- Date: ${devdeck.environment.date}`,
    "",
    "## Token Results",
    "",
    `Primary tokenizer: \`${tokens.primaryTokenizer}\``,
    "",
    "| Mode | Commands | Characters | Primary tokens | Approx tokens |",
    "|---|---:|---:|---:|---:|",
    `| baseline | ${baseline.commands.length} | ${baselineTokens.characters} | ${baselineTokens.primaryTokens} | ${displayCount(baselineTokens.approxTokens)} |`,
    `| devdeck | ${devdeck.commands.length} | ${devdeckTokens.characters} | ${devdeckTokens.primaryTokens} | ${displayCount(devdeckTokens.approxTokens)} |`,
    "",
    "## Command Sequences",
    "",
    "### Baseline",
    "",
    ...baseline.commands.map((command, index) => `${index + 1}. ${command}`),
    "",
    "### DevDeck",
    "",
    ...devdeck.commands.map((command, index) => `${index + 1}. ${command}`),
    "",
    "## Command Attribution",
    "",
    "| Mode | Command | Category | Primary tokens | Approx tokens |",
    "|---|---|---|---:|---:|",
    ...attributionRows(attribution, modes),
    "",
    "## Files",
    "",
    "- baseline transcript: `baseline/transcript.txt`",
    "- DevDeck transcript: `devdeck/transcript.txt`",
    "- command events: `baseline/command-events.json`, `devdeck/command-events.json`",
    "- command attribution: `command-attribution.json`",
    "- token count: `token-count.json`",
    "",
    "## Result",
    "",
    `Primary-token savings: ${tokens.savingsPercent}%`,
    "",
    "## Interpretation",
    "",
    "This benchmark measures agent-visible command transcript size for one fixture.",
    "It does not claim universal token savings across all projects.",
    "",
    "## Caveats",
    "",
    `- Primary tokenizer: \`${tokens.primaryTokenizer}\`.`,
    ...(tokens.primaryTokenizer === "approx-char-div-4"
      ? ["- Approximate fallback mode is active."]
      : []),
    `- ${tokens.caveat}`,
    "- This result is fixture-specific and not a universal claim.",
    "",
  ].join("\n");

  const summaryPath = path.join(runDir, "summary.md");
  await writeFile(summaryPath, summary, "utf8");
  return summaryPath;
}

async function summarizeScenarioResults(runDir) {
  const scenario = await readJson(path.join(runDir, "scenario.json"));
  const tokens = await readJson(path.join(runDir, "token-count.json"));
  const attribution = await readJson(path.join(runDir, "command-attribution.json"));
  const evaluationSummaryPath = path.join(runDir, "evaluation-summary.json");
  const evaluationSummary = await fileExists(evaluationSummaryPath)
    ? await readJson(evaluationSummaryPath)
    : undefined;
  const modes = await listRunModes(runDir);
  const runs = Object.fromEntries(
    await Promise.all(
      modes.map(async (mode) => [mode, await readJson(path.join(runDir, mode, "run.json"))]),
    ),
  );

  const summary = [
    "# DevDeck Benchmark Scenario",
    "",
    "## Scenario",
    "",
    scenario.scenario,
    "",
    "## What this scenario measures",
    "",
    ...(Array.isArray(scenario.measures)
      ? scenario.measures.map((measure) => `- ${measure}`)
      : [scenario.measures]),
    "",
    "## Modes Compared",
    "",
    ...modes.map((mode) => `- ${mode}`),
    "",
    "## Token Results",
    "",
    `Primary tokenizer: \`${tokens.primaryTokenizer}\``,
    "",
    "| Mode | Commands | Characters | Primary tokens | Approx tokens |",
    "|---|---:|---:|---:|---:|",
    ...modes.map(
      (mode) => {
        const values = tokenValues(tokens, mode);
        return `| ${mode} | ${runs[mode].commands.length} | ${values.characters} | ${values.primaryTokens} | ${displayCount(values.approxTokens)} |`;
      },
    ),
    "",
    "## Evaluation Results",
    "",
    "| Mode | Passed | Checks passed | Notes |",
    "|---|---:|---:|---|",
    ...evaluationRows(evaluationSummary, modes),
    "",
    "## Command Attribution",
    "",
    "| Mode | Command | Category | Primary tokens | Approx tokens |",
    "|---|---|---|---:|---:|",
    ...attributionRows(attribution, modes),
    "",
    "## Interpretation",
    "",
    "Happy-path startup measures overhead.",
    "Noisy log scenarios measure context growth and targeted observation cost.",
    "Crash scenarios measure diagnosis cost.",
    "This result is fixture-specific.",
    "",
    "## Caveats",
    "",
    `- Primary tokenizer: \`${tokens.primaryTokenizer}\`.`,
    ...(tokens.primaryTokenizer === "approx-char-div-4"
      ? ["- Approximate fallback mode is active."]
      : []),
    `- ${tokens.caveat}`,
    "- Compare modes only when the fixture, scenario, waits, and counting method are unchanged.",
    "",
  ].join("\n");

  const summaryPath = path.join(runDir, "summary.md");
  await writeFile(summaryPath, summary, "utf8");
  return summaryPath;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const runDir = parseRunDirArgument(process.argv.slice(2));
  const summaryPath = await summarizeResults(runDir ? path.resolve(runDir) : undefined);
  process.stdout.write(`${summaryPath}\n`);
}
