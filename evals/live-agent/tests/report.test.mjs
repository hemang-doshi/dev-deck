import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile } from "node:fs/promises";

import { writeSummary } from "../src/report.mjs";

test("writeSummary aggregates repeat medians and comparison rows", async () => {
  const runDir = await mkdtemp(path.join(os.tmpdir(), "devdeck-live-report-"));
  await writeSummary({
    runDir,
    metadata: {
      date: "2026-06-14T00:00:00.000Z",
      gitSha: "abc123",
      agent: "smoke",
      codexCli: "not checked",
      primaryTokenizer: "tiktoken-o200k_base",
      repeats: 3,
    },
    skipped: null,
    results: [
      {
        id: "api-crash",
        variants: [
          {
            variant: "baseline-shell",
            repeats: [
              { run: { durationMs: 5000, tokens: { transcriptTokens: 600 }, toolCalls: 8, turns: 4, providerUsage: null, exitCode: 0 }, score: { passed: true, derived: { wrongTurns: 2, timeToDiagnosis: 30, timeToRecovery: 50, usedDevDeckRecover: false, usedRawLogs: true } } },
              { run: { durationMs: 4000, tokens: { transcriptTokens: 550 }, toolCalls: 7, turns: 4, providerUsage: null, exitCode: 0 }, score: { passed: true, derived: { wrongTurns: 1, timeToDiagnosis: 25, timeToRecovery: 45, usedDevDeckRecover: false, usedRawLogs: true } } },
              { run: { durationMs: 6000, tokens: { transcriptTokens: 650 }, toolCalls: 9, turns: 5, providerUsage: null, exitCode: 0 }, score: { passed: false, derived: { wrongTurns: 3, timeToDiagnosis: 35, timeToRecovery: 55, usedDevDeckRecover: false, usedRawLogs: true } } },
            ],
          },
          {
            variant: "devdeck-agent",
            repeats: [
              { run: { durationMs: 3000, tokens: { transcriptTokens: 420 }, toolCalls: 5, turns: 3, providerUsage: { totalTokens: 500 }, exitCode: 0 }, score: { passed: true, derived: { wrongTurns: 0, timeToDiagnosis: 10, timeToRecovery: 20, usedDevDeckRecover: true, usedRawLogs: false } } },
              { run: { durationMs: 3200, tokens: { transcriptTokens: 430 }, toolCalls: 4, turns: 3, providerUsage: { totalTokens: 520 }, exitCode: 0 }, score: { passed: true, derived: { wrongTurns: 0, timeToDiagnosis: 12, timeToRecovery: 22, usedDevDeckRecover: true, usedRawLogs: false } } },
              { run: { durationMs: 2800, tokens: { transcriptTokens: 410 }, toolCalls: 4, turns: 3, providerUsage: { totalTokens: 510 }, exitCode: 0 }, score: { passed: true, derived: { wrongTurns: 1, timeToDiagnosis: 9, timeToRecovery: 18, usedDevDeckRecover: true, usedRawLogs: false } } },
            ],
          },
        ],
      },
    ],
  });

  const summaryJson = JSON.parse(await readFile(path.join(runDir, "summary.json"), "utf8"));
  const summaryMd = await readFile(path.join(runDir, "summary.md"), "utf8");

  const devdeckAggregate = summaryJson.aggregates[0].variants.find((variant) => variant.variant === "devdeck-agent").aggregate;
  assert.equal(devdeckAggregate.medianTranscriptTokens, 420);
  assert.equal(devdeckAggregate.medianToolCalls, 4);
  assert.equal(devdeckAggregate.usedDevDeckRecoverRuns, 3);
  assert.match(summaryMd, /\| api-crash \| 66\.7% \| 100\.0% \| 600 \| 420 \| -180 \| 8 \| 4 \| -4 \|/);
});
