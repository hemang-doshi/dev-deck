import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

function formatDuration(durationMs) {
  return `${Math.round(durationMs / 1000)}s`;
}

function median(values) {
  const numbers = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (numbers.length === 0) return null;
  const middle = Math.floor(numbers.length / 2);
  return numbers.length % 2 === 0
    ? Math.round((numbers[middle - 1] + numbers[middle]) / 2)
    : numbers[middle];
}

function percent(part, total) {
  if (!total) return "0.0%";
  return `${((part / total) * 100).toFixed(1)}%`;
}

function delta(baseline, devdeck) {
  if (!Number.isFinite(baseline) || !Number.isFinite(devdeck)) return null;
  return devdeck - baseline;
}

function aggregateVariantRuns(repeats) {
  const passed = repeats.filter((repeat) => repeat.score.passed).length;
  const durationValues = repeats.map((repeat) => repeat.run.durationMs);
  const tokenValues = repeats.map((repeat) => repeat.run.tokens.transcriptTokens);
  const toolCallValues = repeats.map((repeat) => repeat.run.toolCalls);
  const turnValues = repeats.map((repeat) => repeat.run.turns);
  const wrongTurnValues = repeats.map((repeat) => repeat.score.derived.wrongTurns);
  const diagnosisValues = repeats.map((repeat) => repeat.score.derived.timeToDiagnosis);
  const recoveryValues = repeats.map((repeat) => repeat.score.derived.timeToRecovery);
  const providerTotals = repeats
    .map((repeat) => repeat.run.providerUsage?.totalTokens)
    .filter((value) => Number.isFinite(value));

  return {
    runs: repeats.length,
    passed,
    passRate: passed / repeats.length,
    medianTranscriptTokens: median(tokenValues),
    medianToolCalls: median(toolCallValues),
    medianDurationMs: median(durationValues),
    medianTurns: median(turnValues),
    medianWrongTurns: median(wrongTurnValues),
    medianTimeToDiagnosis: median(diagnosisValues),
    medianTimeToRecovery: median(recoveryValues),
    usedDevDeckRecoverRuns: repeats.filter((repeat) => repeat.score.derived.usedDevDeckRecover).length,
    usedRawLogsRuns: repeats.filter((repeat) => repeat.score.derived.usedRawLogs).length,
    providerUsage: providerTotals.length > 0
      ? { medianTotalTokens: median(providerTotals), samples: providerTotals.length }
      : null,
    skipped: repeats.every((repeat) => repeat.run.exitCode !== 0 && repeat.run.turns === 0),
  };
}

function summarizeResults(results) {
  return results.map((scenario) => ({
    id: scenario.id,
    variants: scenario.variants.map((variant) => ({
      variant: variant.variant,
      runs: variant.repeats,
      aggregate: aggregateVariantRuns(variant.repeats),
    })),
  }));
}

function buildComparisonRows(aggregatedResults) {
  return aggregatedResults
    .map((scenario) => {
      const baseline = scenario.variants.find((variant) => variant.variant === "baseline-shell")?.aggregate;
      const devdeck = scenario.variants.find((variant) => variant.variant === "devdeck-agent")?.aggregate;
      if (!baseline || !devdeck) return null;
      return {
        scenario: scenario.id,
        baseline,
        devdeck,
        tokenDelta: delta(baseline.medianTranscriptTokens, devdeck.medianTranscriptTokens),
        callDelta: delta(baseline.medianToolCalls, devdeck.medianToolCalls),
      };
    })
    .filter(Boolean);
}

export async function writeSummary({ runDir, metadata, results, skipped }) {
  const aggregates = summarizeResults(results);
  const comparisons = buildComparisonRows(aggregates);
  const summary = {
    environment: metadata,
    skipped,
    results,
    aggregates,
    comparisons,
    caveats: {
      transcriptTokens: "Local transcript-token approximation using tiktoken-o200k_base.",
      providerUsage: "Provider usage is included only when Codex CLI exposes it.",
    },
  };

  await writeFile(path.join(runDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  const resultRows = aggregates.flatMap((scenario) =>
    scenario.variants.map((variant) => {
      const aggregate = variant.aggregate;
      const provider = aggregate.providerUsage?.medianTotalTokens ?? "n/a";
      return `| ${scenario.id} | ${variant.variant} | ${aggregate.runs} | ${aggregate.passed} | ${percent(aggregate.passed, aggregate.runs)} | ${aggregate.medianTranscriptTokens ?? "n/a"} | ${aggregate.medianToolCalls ?? "n/a"} | ${formatDuration(aggregate.medianDurationMs ?? 0)} | ${aggregate.medianTurns ?? "n/a"} | ${provider} | ${aggregate.skipped ? "yes" : "no"} |`;
    }),
  );

  const comparisonRows = comparisons.map((entry) =>
    `| ${entry.scenario} | ${percent(entry.baseline.passed, entry.baseline.runs)} | ${percent(entry.devdeck.passed, entry.devdeck.runs)} | ${entry.baseline.medianTranscriptTokens ?? "n/a"} | ${entry.devdeck.medianTranscriptTokens ?? "n/a"} | ${entry.tokenDelta ?? "n/a"} | ${entry.baseline.medianToolCalls ?? "n/a"} | ${entry.devdeck.medianToolCalls ?? "n/a"} | ${entry.callDelta ?? "n/a"} |`,
  );

  const markdown = [
    "# DevDeck Live Agent Evaluation",
    "",
    "## Environment",
    "",
    `- Date: ${metadata.date}`,
    `- Git SHA: ${metadata.gitSha}`,
    `- Agent: ${metadata.agent}`,
    `- Codex CLI: ${metadata.codexCli}`,
    `- Primary tokenizer: ${metadata.primaryTokenizer}`,
    "",
    "## Results",
    "",
    "| Scenario | Variant | Runs | Passed | Pass rate | Median transcript tokens | Median tool calls | Median duration | Median turns | Provider usage | Skipped |",
    "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...resultRows,
    "",
    "## Variant Comparison",
    "",
    "| Scenario | Baseline pass rate | DevDeck pass rate | Baseline median tokens | DevDeck median tokens | Token delta | Baseline calls | DevDeck calls | Call delta |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...comparisonRows,
    "",
    "## Interpretation",
    "",
    "This is a live-agent evaluation. Transcript tokens are local transcript approximations using `tiktoken-o200k_base`. Provider-reported usage is shown only when Codex CLI exposes it. Deterministic benchmark results remain the CLI-regression layer; these live results measure real agent behavior on the same fixture family.",
    "",
  ].join("\n");

  await writeFile(path.join(runDir, "summary.md"), markdown, "utf8");
  return summary;
}

export async function publishReportArtifact({ sourceRunDir, reportsDir, dateStamp, skipped }) {
  const targetDir = path.join(reportsDir, `${dateStamp}-codex-live-agent-v2`);
  await mkdir(targetDir, { recursive: true });

  if (skipped) {
    await writeFile(path.join(targetDir, "skipped.md"), skipped, "utf8");
    return targetDir;
  }

  const summaryMd = path.join(sourceRunDir, "summary.md");
  const summaryJson = path.join(sourceRunDir, "summary.json");
  const copy = await import("node:fs/promises").then(({ copyFile }) => copyFile);
  await copy(summaryMd, path.join(targetDir, "summary.md"));
  await copy(summaryJson, path.join(targetDir, "summary.json"));
  return targetDir;
}
