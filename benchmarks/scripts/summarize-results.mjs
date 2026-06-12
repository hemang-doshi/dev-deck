import path from "node:path";
import { writeFile } from "node:fs/promises";

import { parseRunDirArgument, readJson } from "./_shared.mjs";

export async function summarizeResults(runDir) {
  if (!runDir) {
    throw new Error("Usage: node benchmarks/scripts/summarize-results.mjs <results-dir>");
  }

  const baseline = await readJson(path.join(runDir, "baseline/run.json"));
  const devdeck = await readJson(path.join(runDir, "devdeck/run.json"));
  const tokens = await readJson(path.join(runDir, "token-count.json"));

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
    "## Baseline",
    "",
    `- Commands: ${baseline.commands.length}`,
    `- Transcript characters: ${tokens.baseline.characters}`,
    `- Approx tokens: ${tokens.baseline.approxTokens}`,
    "",
    "## DevDeck",
    "",
    `- Commands: ${devdeck.commands.length}`,
    `- Transcript characters: ${tokens.devdeck.characters}`,
    `- Approx tokens: ${tokens.devdeck.approxTokens}`,
    "",
    "## Result",
    "",
    `Approx token savings: ${tokens.savingsPercent}%`,
    "",
    "## Caveats",
    "",
    "- This uses approximate token counting via character_count / 4.",
    "- This result is not a universal claim.",
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
