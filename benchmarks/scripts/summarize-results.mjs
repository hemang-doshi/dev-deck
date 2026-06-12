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
  const attribution = await readJson(path.join(runDir, "command-attribution.json"));
  const attributionRows = Object.entries(attribution.modes).flatMap(([mode, data]) =>
    data.commands.map((event) =>
      `| ${mode} | ${event.commandLabel} | ${event.category} | ${event.characters} | ${event.approxTokens} |`,
    ),
  );

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
    "| Mode | Command | Category | Characters | Approx tokens |",
    "|---|---|---|---:|---:|",
    ...attributionRows,
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
    `Approx token savings: ${tokens.savingsPercent}%`,
    "",
    "## Interpretation",
    "",
    "This benchmark measures agent-visible command transcript size for one fixture.",
    "It does not claim universal token savings across all projects.",
    "",
    "## Caveats",
    "",
    `- This uses approximate token counting via \`${tokens.formula}\`.`,
    `- ${tokens.caveat}`,
    "- This result is fixture-specific and not a universal claim.",
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
