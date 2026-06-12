import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { countTokens } from "../scripts/count-tokens.mjs";
import { evaluateScenario } from "../scripts/evaluate-scenario.mjs";
import { getScenarioDefinition } from "../scripts/scenarios.mjs";
import { summarizeResults } from "../scripts/summarize-results.mjs";
import {
  countTextTokens,
  countTextWithTokenizers,
  supportedTokenizers,
} from "../scripts/tokenizers.mjs";

async function createTempRun() {
  return await mkdtemp(path.join(os.tmpdir(), "devdeck-benchmark-test-"));
}

async function writeMode(runDir, mode, transcript, commandEvents = []) {
  const modeDir = path.join(runDir, mode);
  await mkdir(modeDir, { recursive: true });
  await writeFile(path.join(modeDir, "transcript.txt"), transcript, "utf8");
  await writeFile(
    path.join(modeDir, "command-events.json"),
    `${JSON.stringify(commandEvents, null, 2)}\n`,
    "utf8",
  );
}

test("counts text with approximate and real local tokenizers", async () => {
  assert.deepEqual(supportedTokenizers, [
    "approx-char-div-4",
    "tiktoken-o200k_base",
    "tiktoken-cl100k_base",
  ]);

  const approximate = await countTextTokens("hello world", {
    tokenizer: "approx-char-div-4",
  });
  assert.deepEqual(approximate, {
    tokenizer: "approx-char-div-4",
    model: null,
    tokens: 3,
    characters: 11,
  });

  const result = await countTextWithTokenizers("hello world");
  assert.equal(result.characters, 11);
  assert.equal(result.tokens["approx-char-div-4"], 3);
  assert.ok(result.tokens["tiktoken-o200k_base"] > 0);
  assert.ok(result.tokens["tiktoken-cl100k_base"] > 0);
});

test("writes tokenizer-specific transcript and command attribution counts", async () => {
  const runDir = await createTempRun();
  try {
    const baselineTranscript = "$ health\nok\n";
    const devdeckTranscript = "$ devdeck status --json\n{\"running\":true}\n";
    await writeMode(runDir, "baseline", baselineTranscript, [
      {
        id: "baseline-health",
        commandLabel: "health",
        category: "health-check",
        characters: baselineTranscript.length,
      },
    ]);
    await writeMode(runDir, "devdeck-full", devdeckTranscript, [
      {
        id: "devdeck-status",
        commandLabel: "devdeck status --json",
        category: "state",
        characters: devdeckTranscript.length,
      },
    ]);

    const result = await countTokens(runDir);
    assert.equal(result.primaryTokenizer, "tiktoken-o200k_base");
    assert.equal(
      result.tokenizers["approx-char-div-4"].modes.baseline.tokens,
      Math.ceil(baselineTranscript.length / 4),
    );
    assert.ok(result.tokenizers["tiktoken-o200k_base"].modes["devdeck-full"].tokens > 0);
    assert.deepEqual(result.countedFiles.baseline, ["baseline/transcript.txt"]);

    const attribution = JSON.parse(
      await readFile(path.join(runDir, "command-attribution.json"), "utf8"),
    );
    assert.equal(attribution.primaryTokenizer, "tiktoken-o200k_base");
    assert.deepEqual(attribution.tokenizers, supportedTokenizers);
    assert.equal(
      attribution.modes.baseline.tokens["approx-char-div-4"],
      Math.ceil(baselineTranscript.length / 4),
    );
    assert.equal(
      attribution.modes.baseline.commands[0].primaryTokens,
      attribution.modes.baseline.commands[0].tokens["tiktoken-o200k_base"],
    );

    const fallback = await countTokens(runDir, {
      primaryTokenizer: "approx-char-div-4",
    });
    assert.equal(fallback.primaryTokenizer, "approx-char-div-4");
    assert.deepEqual(Object.keys(fallback.tokenizers), ["approx-char-div-4"]);
  } finally {
    await rm(runDir, { recursive: true, force: true });
  }
});

test("loads scenario expected outcomes from JSON metadata", async () => {
  const apiCrash = await getScenarioDefinition("api-crash");
  assert.equal(apiCrash.id, "api-crash");
  assert.deepEqual(apiCrash.measures, [
    "failure diagnosis",
    "targeted log retrieval",
    "service recovery",
  ]);
  assert.equal(apiCrash.expected.rootCauseContains, "database connection lost");
});

test("evaluates crash diagnosis, recovery, and final verification", async () => {
  const runDir = await createTempRun();
  try {
    await writeFile(
      path.join(runDir, "scenario.json"),
      `${JSON.stringify({
        scenario: "api-crash",
        fixture: "node-api-worker",
      })}\n`,
      "utf8",
    );
    await writeMode(
      runDir,
      "devdeck-full",
      [
        "$ devdeck logs api --tail 40 --severity error",
        "database connection lost",
        "$ devdeck service restart api",
        "api restarted",
        "$ devdeck status --json",
        '{"services":[{"name":"api","state":"running"}]}',
        "",
      ].join("\n"),
    );
    await writeFile(
      path.join(runDir, "devdeck-full", "run.json"),
      `${JSON.stringify({
        mode: "devdeck-full",
        scenario: "api-crash",
        commands: [
          "devdeck logs api --tail 40 --severity error",
          "devdeck service restart api",
          "devdeck status --json",
        ],
        observations: ["failed api identified and restarted"],
        exitCode: 0,
      })}\n`,
      "utf8",
    );

    const evaluation = await evaluateScenario(runDir, "devdeck-full");
    assert.deepEqual(evaluation.checks, {
      observedExpectedFailure: true,
      observedExpectedRootCause: true,
      observedExpectedRecoveryAction: true,
      observedFinalVerification: true,
    });
    assert.deepEqual(evaluation.score, {
      passed: true,
      passedChecks: 4,
      totalChecks: 4,
    });

    const saved = JSON.parse(
      await readFile(path.join(runDir, "devdeck-full", "evaluation.json"), "utf8"),
    );
    assert.deepEqual(saved, evaluation);
    const aggregate = JSON.parse(
      await readFile(path.join(runDir, "evaluation-summary.json"), "utf8"),
    );
    assert.equal(aggregate.passed, true);
    assert.deepEqual(aggregate.modes["devdeck-full"], evaluation);
  } finally {
    await rm(runDir, { recursive: true, force: true });
  }
});

test("recognizes baseline service-before-recovery wording", async () => {
  const runDir = await createTempRun();
  try {
    await writeFile(
      path.join(runDir, "scenario.json"),
      `${JSON.stringify({ scenario: "api-crash", fixture: "node-api-worker" })}\n`,
      "utf8",
    );
    await writeMode(
      runDir,
      "baseline",
      [
        "$ tail -n 80 api.log",
        "database connection lost",
        "$ npm run api",
        "respawned pid 123",
        "$ curl http://127.0.0.1:3100/health",
        "HTTP 200",
        "",
      ].join("\n"),
    );
    await writeFile(
      path.join(runDir, "baseline", "run.json"),
      `${JSON.stringify({
        mode: "baseline",
        scenario: "api-crash",
        commands: ["tail -n 80 api.log", "npm run api", "curl http://127.0.0.1:3100/health"],
        observations: ["failed api identified and restarted manually"],
        exitCode: 0,
      })}\n`,
      "utf8",
    );

    const evaluation = await evaluateScenario(runDir, "baseline");
    assert.equal(evaluation.checks.observedExpectedRecoveryAction, true);
    assert.equal(evaluation.checks.observedFinalVerification, true);
  } finally {
    await rm(runDir, { recursive: true, force: true });
  }
});

test("scenario summary reports primary, approximate, evaluation, and attribution metrics", async () => {
  const runDir = await createTempRun();
  try {
    await writeFile(
      path.join(runDir, "scenario.json"),
      `${JSON.stringify({
        scenario: "happy-path",
        fixture: "node-api-worker",
        description: "Happy-path startup and routine service inspection.",
        measures: ["orchestration overhead", "state observation overhead"],
      })}\n`,
      "utf8",
    );
    const transcript = [
      "$ devdeck status --json",
      '{"services":[{"name":"api","state":"running"}]}',
      "$ devdeck service restart api",
      "api restarted",
      "",
    ].join("\n");
    await writeMode(runDir, "devdeck-full", transcript, [
      {
        id: "status",
        commandLabel: "devdeck status --json",
        category: "state",
        characters: 73,
      },
      {
        id: "restart",
        commandLabel: "devdeck service restart api",
        category: "control",
        characters: transcript.length - 73,
      },
    ]);
    await writeFile(
      path.join(runDir, "devdeck-full", "run.json"),
      `${JSON.stringify({
        mode: "devdeck-full",
        scenario: "happy-path",
        commands: ["devdeck status --json", "devdeck service restart api"],
        observations: ["api restarted"],
        exitCode: 0,
      })}\n`,
      "utf8",
    );

    await countTokens(runDir);
    await evaluateScenario(runDir, "devdeck-full");
    const summaryPath = await summarizeResults(runDir);
    const summary = await readFile(summaryPath, "utf8");

    assert.match(summary, /Primary tokenizer: `tiktoken-o200k_base`/);
    assert.match(
      summary,
      /\| Mode \| Commands \| Characters \| Primary tokens \| Approx tokens \|/,
    );
    assert.match(summary, /## Evaluation Results/);
    assert.match(summary, /\| devdeck-full \| yes \| 3\/3 \|/);
    assert.match(
      summary,
      /\| Mode \| Command \| Category \| Primary tokens \| Approx tokens \|/,
    );
  } finally {
    await rm(runDir, { recursive: true, force: true });
  }
});
