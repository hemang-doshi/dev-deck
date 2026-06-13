import path from "node:path";

import { readJson, writeJson } from "../_shared.mjs";

function formatDuration(durationMs) {
  return `${(durationMs / 1000).toFixed(1)}s`;
}

function summarizeRow({ runData, evaluation }) {
  return {
    scenario: runData.scenario,
    mode: runData.mode,
    passed: evaluation.passed,
    transcriptTokens: runData.metrics.transcriptTokens,
    toolCalls: runData.metrics.totalToolCalls,
    runtimeManagementToolCalls: runData.metrics.runtimeManagementToolCalls,
    durationMs: runData.durationMs,
    failure: evaluation.failureReason,
  };
}

export async function writeProductValidationSummary(runRoot, rows) {
  const matrixResultsPath = path.join(runRoot, "matrix-results.json");
  const matrixSummaryPath = path.join(runRoot, "matrix-summary.md");
  const summaryRows = rows.map(summarizeRow);

  const lines = [
    "# Product Validation Matrix",
    "",
    "| Scenario | Mode | Passed | Transcript tokens | Tool calls | Runtime-management tool calls | Duration | Failure |",
    "|---|---|---:|---:|---:|---:|---:|---|",
    ...summaryRows.map((row) =>
      `| ${row.scenario} | ${row.mode} | ${row.passed ? "yes" : "no"} | ${row.transcriptTokens} | ${row.toolCalls} | ${row.runtimeManagementToolCalls} | ${formatDuration(row.durationMs)} | ${row.failure ?? ""} |`
    ),
    "",
    "Provider-reported tokens are not available in this deterministic harness slice. Transcript tokens are local tokenizer counts from the captured command transcript.",
  ];

  await writeJson(matrixResultsPath, {
    generatedAt: new Date().toISOString(),
    rows,
  });
  await import("node:fs/promises").then(({ writeFile }) =>
    writeFile(matrixSummaryPath, `${lines.join("\n")}\n`, "utf8")
  );

  return {
    matrixResultsPath,
    matrixSummaryPath,
  };
}
