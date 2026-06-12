import path from "node:path";
import { writeFile } from "node:fs/promises";

import { createRunDirectory, ensureEmptyDirectory, readJson, writeJson } from "./_shared.mjs";
import { runScenario } from "./run-scenario.mjs";
import { validateV0 } from "./validate-v0.mjs";

const matrix = {
  "happy-path": [
    "baseline",
    "devdeck-full",
    "devdeck-status-only",
    "devdeck-snapshot-only",
  ],
  "noisy-worker": [
    "baseline",
    "devdeck-full",
    "devdeck-logs-only",
    "devdeck-snapshot-only",
  ],
  "api-crash": [
    "baseline",
    "devdeck-full",
    "devdeck-status-only",
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
    tokenizer: "approx-char-div-4",
    formula: "ceil(character_count / 4)",
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
    results.scenarios[scenario] = {
      modes: tokenCount.modes,
      comparisons: tokenCount.comparisons,
      commandAttribution: attribution.modes,
      files: {
        summary: path.relative(resolvedRunDir, path.join(scenarioRunDir, "summary.md")),
        tokenCount: path.relative(resolvedRunDir, path.join(scenarioRunDir, "token-count.json")),
        commandAttribution: path.relative(
          resolvedRunDir,
          path.join(scenarioRunDir, "command-attribution.json"),
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
      return `| ${scenario} | ${mode} | ${values.characters} | ${values.approxTokens} | ${savings} |`;
    }),
  );
  const summary = [
    "# DevDeck Benchmark Realism Matrix",
    "",
    "This matrix compares agent-visible transcript size across the same fixture under healthy, noisy, and failing runtime conditions.",
    "",
    "| Scenario | Mode | Characters | Approx tokens | Savings vs baseline |",
    "|---|---|---:|---:|---:|",
    ...rows,
    "",
    "## Interpretation",
    "",
    "- Happy-path results primarily measure orchestration overhead.",
    "- Noisy-worker results measure repeated log observation and filtering cost.",
    "- API-crash results measure runtime diagnosis and recovery cost.",
    "- Negative savings identify transcript overhead; they are not product-wide conclusions.",
    "- All numbers are fixture-specific and use `ceil(character_count / 4)`.",
    "",
  ].join("\n");
  await writeFile(path.join(resolvedRunDir, "matrix-summary.md"), summary, "utf8");
  return resolvedRunDir;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const runDir = await runRealismMatrix({ runDir: parseRunDir(process.argv.slice(2)) });
  process.stdout.write(`Benchmark realism matrix complete.\nResults: ${runDir}\n`);
}
