import path from "node:path";
import { writeFile } from "node:fs/promises";

import { createRunDirectory, ensureEmptyDirectory, readJson, writeJson } from "./_shared.mjs";
import { runScenario } from "./run-scenario.mjs";
import { validateV0 } from "./validate-v0.mjs";

const matrix = {
  "happy-path": [
    "baseline",
    "devdeck-status-only",
    "devdeck-agent-status",
    "devdeck-agent-snapshot",
  ],
  "noisy-worker": [
    "baseline",
    "devdeck-logs-only",
    "devdeck-agent-logs",
    "devdeck-agent-snapshot",
  ],
  "api-crash": [
    "baseline",
    "devdeck-status-only",
    "devdeck-agent-status",
    "devdeck-agent-full",
  ],
};

function parseRunDir(argv) {
  const index = argv.indexOf("--run-dir");
  if (index === -1) return undefined;
  if (!argv[index + 1]) {
    throw new Error("--run-dir requires a path.");
  }
  return argv[index + 1];
}

export async function runRealismMatrix({ runDir } = {}) {
  await validateV0();
  const resolvedRunDir = await createRunDirectory(runDir);
  await ensureEmptyDirectory(resolvedRunDir);
  const results = {
    version: 1,
    fixture: "node-api-worker",
    startedAt: new Date().toISOString(),
    scenarios: {},
  };

  for (const [scenario, modes] of Object.entries(matrix)) {
    const scenarioRunDir = path.join(resolvedRunDir, scenario);
    for (const mode of modes) {
      await runScenario({ scenario, mode, runDir: scenarioRunDir });
    }

    const tokenCount = await readJson(path.join(scenarioRunDir, "token-count.json"));
    const attribution = await readJson(path.join(scenarioRunDir, "command-attribution.json"));
    const evaluations = await readJson(path.join(scenarioRunDir, "evaluation-summary.json"));
    results.primaryTokenizer ??= tokenCount.primaryTokenizer;
    results.tokenizers ??= Object.keys(tokenCount.tokenizers);
    results.scenarios[scenario] = {
      modes: tokenCount.modes,
      comparisons: tokenCount.comparisons,
      tokenizers: tokenCount.tokenizers,
      evaluations: evaluations.modes,
      commandAttribution: attribution.modes,
      files: {
        summary: path.relative(resolvedRunDir, path.join(scenarioRunDir, "summary.md")),
        tokenCount: path.relative(resolvedRunDir, path.join(scenarioRunDir, "token-count.json")),
        commandAttribution: path.relative(
          resolvedRunDir,
          path.join(scenarioRunDir, "command-attribution.json"),
        ),
        evaluationSummary: path.relative(
          resolvedRunDir,
          path.join(scenarioRunDir, "evaluation-summary.json"),
        ),
      },
    };
  }

  results.endedAt = new Date().toISOString();
  await writeJson(path.join(resolvedRunDir, "matrix-results.json"), results);

  const rows = Object.entries(results.scenarios).flatMap(([scenario, scenarioResult]) =>
    Object.entries(scenarioResult.modes).map(([mode, values]) => {
      const comparison = scenarioResult.comparisons[`${mode}-vs-baseline`];
      const savings = comparison ? `${comparison.savingsPercent}%` : "-";
      const evaluation = scenarioResult.evaluations[mode];
      return `| ${scenario} | ${mode} | ${values.primaryTokens} | ${savings} | ${evaluation?.score.passed ? "yes" : "no"} |`;
    }),
  );
  const summary = [
    "# DevDeck Benchmark Realism Matrix",
    "",
    "This matrix compares agent-visible transcript size across the same fixture under healthy, noisy, and failing runtime conditions.",
    "",
    `Primary tokenizer: \`${results.primaryTokenizer}\``,
    "",
    "| Scenario | Mode | Primary tokens | Savings vs baseline | Evaluation passed |",
    "|---|---|---:|---:|---:|",
    ...rows,
    "",
    "## Interpretation",
    "",
    "- Happy-path results primarily measure orchestration overhead.",
    "- Noisy-worker results measure repeated log observation and filtering cost.",
    "- API-crash results measure runtime diagnosis and recovery cost.",
    "- Negative savings identify transcript overhead; they are not product-wide conclusions.",
    `- All numbers are fixture-specific and use \`${results.primaryTokenizer}\` as the primary tokenizer.`,
    "- Provider-reported usage may differ for live agent runs.",
    "",
  ].join("\n");
  await writeFile(path.join(resolvedRunDir, "matrix-summary.md"), summary, "utf8");
  return resolvedRunDir;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const runDir = await runRealismMatrix({ runDir: parseRunDir(process.argv.slice(2)) });
  process.stdout.write(`Benchmark realism matrix complete.\nResults: ${runDir}\n`);
}
