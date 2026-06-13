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

function eventMatches(events, matcher) {
  return events.find((event) => matcher.test(event.output ?? ""));
}

function elapsedMs(runData, isoTimestamp) {
  if (!isoTimestamp) {
    return null;
  }
  return new Date(isoTimestamp).getTime() - new Date(runData.startedAt).getTime();
}

function earliestTimestamp(...timestamps) {
  const values = timestamps.filter(Boolean).map((value) => new Date(value).getTime());
  if (values.length === 0) {
    return null;
  }
  return new Date(Math.min(...values)).toISOString();
}

function buildScenarioEvidenceMatcher(scenario) {
  switch (scenario) {
    case "missing-env":
      return /missing required env|startup config error/i;
    case "port-conflict":
      return /EADDRINUSE|address already in use/i;
    case "api-crash-after-start":
      return /simulated crash after startup|api exiting with code 1|dashboard bootstrap failed/i;
    case "noisy-worker":
      return /queue latency above threshold|debug queue scan complete/i;
    default:
      return null;
  }
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
      ?? findEvent(events, "devdeck-optimized-cleanup")?.exitCode
      ?? findEvent(events, "manual-runtime-cleanup-after-error")?.exitCode
      ?? findEvent(events, "devdeck-current-cleanup-after-error")?.exitCode
      ?? findEvent(events, "devdeck-optimized-cleanup-after-error")?.exitCode
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
  const evidenceMatcher = buildScenarioEvidenceMatcher(runData.scenario);

  const healthEvent = events.find((event) =>
    event.id === `${runData.mode}-health` || event.id === `${runData.mode}-health-post-crash`
  );
  const successfulHealthEvent = events.find((event) =>
    event.id === `${runData.mode}-health` && event.exitCode === 0
  );
  const boundedHealthyState = events.find((event) =>
    (event.category === "startup" || event.category === "state") &&
    /START ok|STATE running|SERVICES all_ready/i.test(event.output ?? "")
  );
  const failureEvidenceEvent = evidenceMatcher
    ? eventMatches(events, evidenceMatcher)
    : null;
  const degradedStateEvent = events.find((event) =>
    event.category === "state" && /STATE degraded|issue=|I error /i.test(event.output ?? "")
  );
  const cleanupSucceeded = events.some((event) =>
    event.category === "cleanup" && event.exitCode === 0
  );
  const cleanupEvents = events.filter((event) => event.category === "cleanup");
  const diagnoseEvent = events.find((event) => event.category === "diagnosis");
  const recoveryEvent = events.find((event) => event.category === "recovery");

  switch (runData.scenario) {
    case "startup-success": {
      const healthPassed = events.some((event) =>
        event.id === `${runData.mode}-health` && event.exitCode === 0
      );
      const boundedHealthy = Boolean(boundedHealthyState);
      passed = (healthPassed || boundedHealthy) && cleanupSucceeded && runData.exitCode === 0;
      if (healthPassed || boundedHealthy) observations.push("fixture health check passed");
      if (!passed) {
        failureReason = !(healthPassed || boundedHealthy)
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
      const boundedHealthy = Boolean(boundedHealthyState);
      const crashEvidence = hasEvidence(
        serviceLogs,
        /simulated crash after startup|api exiting with code 1|dashboard bootstrap failed/i,
      );
      const postCrashFailure = events.some((event) =>
        event.id === `${runData.mode}-health-post-crash` && event.exitCode !== 0
      ) || events.some((event) =>
        (event.category === "diagnosis" || event.category === "state") &&
        /service_crash|simulated crash after startup|STATE degraded/i.test(event.output ?? "")
      );
      passed = (initialHealthPassed || boundedHealthy) && crashEvidence && postCrashFailure && cleanupSucceeded;
      if (initialHealthPassed || boundedHealthy) observations.push("stack became healthy before the crash");
      if (crashEvidence) observations.push("api crash evidence captured");
      if (!passed) {
        failureReason = !(initialHealthPassed || boundedHealthy)
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
      const boundedHealthy = Boolean(boundedHealthyState);
      const warningEvidence = hasEvidence(
        serviceLogs,
        /queue latency above threshold|debug queue scan complete/i,
      );
      passed = (healthPassed || boundedHealthy) && warningEvidence && cleanupSucceeded;
      if (healthPassed || boundedHealthy) observations.push("fixture health check passed");
      if (warningEvidence) observations.push("worker noise evidence captured");
      if (!passed) {
        failureReason = !(healthPassed || boundedHealthy)
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
      timing: {
        total_duration_ms: runData.durationMs,
        time_to_first_signal_ms: elapsedMs(
          runData,
          earliestTimestamp(
            successfulHealthEvent?.endedAt ?? null,
            boundedHealthyState?.endedAt ?? null,
            failureEvidenceEvent?.endedAt ?? null,
            degradedStateEvent?.endedAt ?? null,
          ),
        ),
        time_to_healthy_ms: elapsedMs(runData, successfulHealthEvent?.endedAt ?? boundedHealthyState?.endedAt ?? null),
        time_to_failure_evidence_ms: elapsedMs(
          runData,
          failureEvidenceEvent?.endedAt ?? degradedStateEvent?.endedAt ?? null,
        ),
        time_to_diagnosis_ms: elapsedMs(runData, diagnoseEvent?.endedAt ?? null),
        time_to_recovery_ms: elapsedMs(runData, recoveryEvent?.endedAt ?? null),
        time_to_cleanup_ms: cleanupEvents.length > 0
          ? new Date(cleanupEvents.at(-1).endedAt).getTime()
              - new Date(cleanupEvents[0].startedAt).getTime()
          : null,
      },
    },
  };

  await writeJson(path.join(modeDir, "evaluation.json"), evaluation);
  return evaluation;
}
