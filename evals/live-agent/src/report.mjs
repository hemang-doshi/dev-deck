import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

function formatDuration(durationMs) {
  return `${Math.round(durationMs / 1000)}s`;
}

function compareSavings(baseline, devdeck) {
  if (!Number.isFinite(baseline) || !Number.isFinite(devdeck) || baseline <= 0) return "n/a";
  const savings = ((baseline - devdeck) / baseline) * 100;
  return `${savings.toFixed(1)}%`;
}

export async function writeSummary({ runDir, metadata, results, skipped }) {
  const summary = {
    environment: metadata,
    skipped,
    results,
  };

  await writeFile(path.join(runDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  const rows = results.flatMap((scenario) =>
    scenario.variants.map((variant) =>
      `| ${scenario.id} | ${variant.variant} | ${variant.score.passed ? "yes" : "no"} | ${variant.run.tokens.transcriptTokens} | ${variant.run.toolCalls} | ${variant.run.turns} | ${formatDuration(variant.run.durationMs)} |`,
    ),
  );

  const comparisons = results
    .map((scenario) => {
      const baseline = scenario.variants.find((variant) => variant.variant === "baseline-shell");
      const devdeck = scenario.variants.find((variant) => variant.variant === "devdeck-agent");
      if (!baseline || !devdeck) return null;
      return `| ${scenario.id} | ${baseline.run.tokens.transcriptTokens} | ${devdeck.run.tokens.transcriptTokens} | ${compareSavings(baseline.run.tokens.transcriptTokens, devdeck.run.tokens.transcriptTokens)} |`;
    })
    .filter(Boolean);

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
    "| Scenario | Variant | Passed | Transcript tokens | Tool calls | Turns | Duration |",
    "|---|---|---:|---:|---:|---:|---:|",
    ...rows,
    "",
    "## Token Comparison",
    "",
    "| Scenario | Baseline tokens | DevDeck tokens | Savings |",
    "|---|---:|---:|---:|",
    ...comparisons,
    "",
    "## Interpretation",
    "",
    "This is a live-agent evaluation. Transcript tokens are model-visible transcript approximations using `tiktoken-o200k_base`. Provider-reported usage is shown when available. Results are scenario-specific and should not be treated as universal claims.",
    skipped ? "" : "",
    "",
  ].join("\n");

  await writeFile(path.join(runDir, "summary.md"), markdown, "utf8");
  return summary;
}

export async function publishReportArtifact({ sourceRunDir, reportsDir, dateStamp, skipped }) {
  const targetDir = path.join(reportsDir, `${dateStamp}-codex-live-agent-v1`);
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
