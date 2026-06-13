import path from "node:path";
import { readFile } from "node:fs/promises";

import { readJson, writeJson } from "../_shared.mjs";
import { loadScenarioDefinition } from "./complex-fixture.mjs";

function toActualPath(filePath) {
  return path.resolve(filePath);
}

async function readText(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

function findEvent(events, id) {
  return events.find((event) => event.id === id) ?? null;
}

function hasEvidence(chunks, matcher) {
  return chunks.some((chunk) => matcher.test(chunk));
}

function collectActual(runData, events) {
  const categories = events.reduce((accumulator, event) => {
    accumulator[event.category] = (accumulator[event.category] ?? 0) + 1;
    return accumulator;
  }, {});

  return {
    harnessExitCode: runData.exitCode,
    transcript: toActualPath(runData.outputs.transcript),
    serviceLogs: toActualPath(runData.outputs.serviceLogs),
    metrics: runData.metrics,
    eventCountsByCategory: categories,
    cleanupExitCode: findEvent(events, "manual-runtime-cleanup")?.exitCode
      ?? findEvent(events, "devdeck-current-cleanup")?.exitCode
      ?? findEvent(events, "manual-runtime-cleanup-after-error")?.exitCode
      ?? findEvent(events, "devdeck-current-cleanup-after-error")?.exitCode
      ?? null,
  };
}

export async function evaluateProductValidationRun(modeDir) {
  const runData = await readJson(path.join(modeDir, "run.json"));
  const events = await readJson(path.join(modeDir, "command-events.json"));
  const scenarioDefinition = await loadScenarioDefinition(runData.scenario);
  const transcript = await readText(runData.outputs.transcript);
  const apiLog = await readText(path.join(runData.outputs.serviceLogs, "api.log"));
  const workerLog = await readText(path.join(runData.outputs.serviceLogs, "worker.log"));
  const serviceLogs = [apiLog, workerLog, transcript];
  const observations = [];
  let passed = false;
  let failureReason = null;

  const healthEvent = events.find((event) =>
    event.id === `${runData.mode}-health` || event.id === `${runData.mode}-health-post-crash`
  );
  const cleanupSucceeded = events.some((event) =>
    event.category === "cleanup" && event.exitCode === 0
  );

  switch (runData.scenario) {
    case "startup-success": {
      const healthPassed = events.some((event) =>
        event.id === `${runData.mode}-health` && event.exitCode === 0
      );
      passed = healthPassed && cleanupSucceeded && runData.exitCode === 0;
      if (healthPassed) observations.push("fixture health check passed");
      if (!passed) {
        failureReason = !healthPassed
          ? "health check did not pass"
          : "cleanup did not complete cleanly";
      }
      break;
    }
    case "missing-env": {
      const missingEnvEvidence = hasEvidence(
        serviceLogs,
        /missing required env|startup config error/i,
      );
      passed = missingEnvEvidence && cleanupSucceeded;
      if (missingEnvEvidence) observations.push("api emitted missing env evidence");
      if (!passed) {
        failureReason = !missingEnvEvidence
          ? "missing env evidence not found"
          : "cleanup did not complete cleanly";
      }
      break;
    }
    case "port-conflict": {
      const conflictEvidence = hasEvidence(
        serviceLogs,
        /EADDRINUSE|address already in use/i,
      );
      passed = conflictEvidence && cleanupSucceeded;
      if (conflictEvidence) observations.push("port conflict evidence captured");
      if (!passed) {
        failureReason = !conflictEvidence
          ? "port conflict evidence not found"
          : "cleanup did not complete cleanly";
      }
      break;
    }
    case "api-crash-after-start": {
      const initialHealthPassed = events.some((event) =>
        event.id === `${runData.mode}-health` && event.exitCode === 0
      );
      const crashEvidence = hasEvidence(
        serviceLogs,
        /simulated crash after startup|api exiting with code 1|dashboard bootstrap failed/i,
      );
      const postCrashFailure = events.some((event) =>
        event.id === `${runData.mode}-health-post-crash` && event.exitCode !== 0
      );
      passed = initialHealthPassed && crashEvidence && postCrashFailure && cleanupSucceeded;
      if (initialHealthPassed) observations.push("stack became healthy before the crash");
      if (crashEvidence) observations.push("api crash evidence captured");
      if (!passed) {
        failureReason = !initialHealthPassed
          ? "stack never became healthy before crash observation"
          : !crashEvidence
            ? "api crash evidence not found"
            : !postCrashFailure
              ? "post-crash degradation was not observed"
              : "cleanup did not complete cleanly";
      }
      break;
    }
    case "noisy-worker": {
      const healthPassed = events.some((event) =>
        event.id === `${runData.mode}-health` && event.exitCode === 0
      );
      const warningEvidence = hasEvidence(
        serviceLogs,
        /queue latency above threshold|debug queue scan complete/i,
      );
      passed = healthPassed && warningEvidence && cleanupSucceeded;
      if (healthPassed) observations.push("fixture health check passed");
      if (warningEvidence) observations.push("worker noise evidence captured");
      if (!passed) {
        failureReason = !healthPassed
          ? "health check did not pass"
          : !warningEvidence
            ? "worker noise evidence not found"
            : "cleanup did not complete cleanly";
      }
      break;
    }
    default:
      failureReason = `no evaluator for scenario ${runData.scenario}`;
  }

  const evaluation = {
    scenario: runData.scenario,
    mode: runData.mode,
    passed,
    failureReason,
    observations,
    expected: scenarioDefinition.expected,
    actual: {
      ...collectActual(runData, events),
      healthExitCode: healthEvent?.exitCode ?? null,
      transcriptContainsExpectedRootCause: scenarioDefinition.expected.rootCauseContains
        ? transcript.includes(scenarioDefinition.expected.rootCauseContains)
        : null,
    },
  };

  await writeJson(path.join(modeDir, "evaluation.json"), evaluation);
  return evaluation;
}
