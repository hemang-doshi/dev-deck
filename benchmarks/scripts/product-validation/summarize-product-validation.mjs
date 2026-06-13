import path from "node:path";

import { readJson, writeJson } from "../_shared.mjs";

function formatDuration(durationMs) {
  if (durationMs === null || durationMs === undefined) {
    return "";
  }
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
    devdeckCommands: runData.metrics.devdeckCommands,
    logInspectionCommands: runData.metrics.logInspectionCommands,
    diagnoseCommands: runData.metrics.diagnoseCommands,
    restartCommands: runData.metrics.restartCommands,
    hiddenEvaluatorCommands: runData.metrics.hiddenEvaluatorCommands,
    durationMs: runData.durationMs,
    firstSignalMs: evaluation.actual.timing?.time_to_first_signal_ms ?? null,
    diagnosisMs: evaluation.actual.timing?.time_to_diagnosis_ms ?? null,
    recoveryMs: evaluation.actual.timing?.time_to_recovery_ms ?? null,
    healthyMs: evaluation.actual.timing?.time_to_healthy_ms ?? null,
    failureEvidenceMs: evaluation.actual.timing?.time_to_failure_evidence_ms ?? null,
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
    "| Scenario | Mode | Passed | Tokens | Tool calls | Runtime calls | DevDeck | Logs | Diagnose | Restart | Hidden | Duration | First signal | Diagnosis | Recovery | Healthy | Failure evidence | Failure |",
    "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|",
    ...summaryRows.map((row) =>
      `| ${row.scenario} | ${row.mode} | ${row.passed ? "yes" : "no"} | ${row.transcriptTokens} | ${row.toolCalls} | ${row.runtimeManagementToolCalls} | ${row.devdeckCommands} | ${row.logInspectionCommands} | ${row.diagnoseCommands} | ${row.restartCommands} | ${row.hiddenEvaluatorCommands} | ${formatDuration(row.durationMs)} | ${formatDuration(row.firstSignalMs)} | ${formatDuration(row.diagnosisMs)} | ${formatDuration(row.recoveryMs)} | ${formatDuration(row.healthyMs)} | ${formatDuration(row.failureEvidenceMs)} | ${row.failure ?? ""} |`
    ),
    "",
    "Interpretation:",
    "- A faster failing run is not a product win.",
    "- Prefer successful fast paths first, then actionable fast failures, over non-actionable fast failures.",
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
