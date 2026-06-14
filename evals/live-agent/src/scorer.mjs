function normalize(text) {
  return String(text ?? "").toLowerCase();
}

function includesAny(text, candidates) {
  const corpus = normalize(text);
  return candidates.some((candidate) => corpus.includes(normalize(candidate)));
}

function matches(text, pattern) {
  return pattern.test(normalize(text));
}

function hasFinalHealth(text) {
  return includesAny(text, [
    "final health result: ok",
    "final health: ok",
    "running and healthy",
    "healthy after targeted restart",
    "services all_ready",
    "all services healthy",
  ]) || matches(text, /\b(api|services?)\b[^\n]{0,40}\b(running|healthy|ready)\b/);
}

function hasFailedService(text, service) {
  return includesAny(text, [
    `failed service: ${service}`,
    `failed service ${service}`,
    `service: ${service}`,
    `${service} failed`,
    `svc=${service}`,
  ]) || matches(text, new RegExp(`failed service:\\s*\`?${service}\`?`));
}

function hasRecoverAction(text, service = "api") {
  return includesAny(text, [
    "recover ok",
    "devdeck recover",
    "recover --agent",
    "recovered",
    "action=restart",
    `devdeck service restart ${service}`,
    `restart ${service}`,
    `restarted ${service}`,
  ]) || matches(text, new RegExp(`recover[^\\n]{0,80}svc=${service}`))
    || matches(text, new RegExp(`restart(?:ed|ing)?(?:\\s+\\w+){0,4}\\s+${service}`))
    || matches(text, new RegExp(`${service}(?:\\s+\\w+){0,4}\\s+restart(?:ed|ing)?`));
}

function usedRawLogs(text) {
  return matches(text, /\b(tail|cat|less|grep|rg|sed)\b[^\n]{0,80}\b(log|stdout|stderr)\b/);
}

function usedDevDeckRecover(text) {
  return includesAny(text, ["devdeck recover", "recover --agent", "recover ok"]);
}

function extractTimeToFirst(text, label) {
  const pattern = new RegExp(`\\$[^\\n]*${label}[^\\n]*`, "ig");
  const match = pattern.exec(text);
  return match ? match.index : null;
}

function buildDerivedMetrics(corpus) {
  const lowered = normalize(corpus);
  const diagnosisIndex = Math.min(
    ...[
      extractTimeToFirst(lowered, "diag "),
      extractTimeToFirst(lowered, "devdeck diagnose"),
      extractTimeToFirst(lowered, "cause "),
    ].filter((value) => value !== null),
  );
  const recoveryIndex = Math.min(
    ...[
      extractTimeToFirst(lowered, "devdeck recover"),
      extractTimeToFirst(lowered, "recover ok"),
      extractTimeToFirst(lowered, "service restart"),
      extractTimeToFirst(lowered, "restart api"),
    ].filter((value) => value !== null),
  );
  const wrongTurns = [
    includesAny(lowered, ["devdeck diagnose --agent"]) && includesAny(lowered, ["diag degraded root="]),
    matches(lowered, /\$[^$\n]*devdeck status --agent/g) && (lowered.match(/\$[^$\n]*devdeck status --agent/g) ?? []).length > 2,
    usedRawLogs(lowered),
  ].filter(Boolean).length;

  return {
    wrongTurns,
    usedDevDeckRecover: usedDevDeckRecover(lowered),
    usedRawLogs: usedRawLogs(lowered),
    timeToDiagnosis: Number.isFinite(diagnosisIndex) ? diagnosisIndex : null,
    timeToRecovery: Number.isFinite(recoveryIndex) ? recoveryIndex : null,
  };
}

function scoreStartupSuccess({ corpus }) {
  return {
    noFailureClaim: !includesAny(corpus, ["failed service: api", "state degraded", "recover ok"]),
    finalHealthVerified: hasFinalHealth(corpus),
    noUnnecessaryDiagnosis: !includesAny(corpus, ["devdeck diagnose", "diag degraded root="]),
    cleanStop: includesAny(corpus, ["devdeck stop --agent", "cleanup complete", "stop ok"]),
  };
}

function scoreMissingEnv({ scenario, corpus, variant }) {
  return {
    failedServiceIdentified: hasFailedService(corpus, scenario.expected.failedService),
    rootCauseIdentified: includesAny(corpus, [scenario.expected.rootCauseContains, "database_url", "session_secret"]),
    boundedDiagnosisUsed: variant === "devdeck-agent"
      ? includesAny(corpus, ["diag degraded root=missing_env", "cause api missing required environment variable"])
      : true,
    noIncorrectRecovery: !includesAny(corpus, ["recover ok", "action=restart", "restart api"]),
    cleanupPerformed: includesAny(corpus, ["devdeck stop --agent", "cleanup complete", "stop ok"]),
  };
}

function scorePortConflict({ scenario, corpus, variant }) {
  return {
    failedServiceIdentified: hasFailedService(corpus, scenario.expected.failedService),
    rootCauseIdentified: includesAny(corpus, [scenario.expected.rootCauseContains, "address already in use", "port 4000"]),
    boundedDiagnosisUsed: variant === "devdeck-agent"
      ? includesAny(corpus, ["diag degraded root=port_conflict", "cause api failed to bind port 4000"])
      : true,
    noIncorrectRecovery: !includesAny(corpus, ["recover ok", "action=restart"]),
    cleanupPerformed: includesAny(corpus, ["devdeck stop --agent", "cleanup complete", "stop ok"]),
  };
}

function scoreApiCrash({ scenario, corpus }) {
  return {
    failedServiceIdentified: hasFailedService(corpus, scenario.expected.failedService),
    rootCauseIdentified: includesAny(corpus, [
      scenario.expected.rootCauseContains,
      "service_crash",
      "exited after startup with non-zero code",
    ]),
    recoveryActionTaken: hasRecoverAction(corpus, scenario.expected.failedService),
    finalHealthVerified: hasFinalHealth(corpus),
  };
}

function scoreNoisyWorker({ scenario, corpus, toolCalls }) {
  return {
    warningIdentified: includesAny(corpus, [scenario.expected.warningContains, "warning worker"]),
    noFalseFailedServiceClaim: !includesAny(corpus, [
      "failed service: api",
      "failed service: worker",
      "service failed",
      "state degraded",
      "recover ok",
    ]),
    finalHealthVerified: hasFinalHealth(corpus),
    boundedToolUsage: toolCalls <= scenario.limits.maxToolCalls,
  };
}

export function scoreRun({ scenario, variant, transcript, finalAnswer, toolCalls }) {
  const corpus = `${transcript}\n${finalAnswer}`;
  const notes = [];
  let checks;

  switch (scenario.id) {
    case "startup-success":
      checks = scoreStartupSuccess({ corpus });
      break;
    case "missing-env":
      checks = scoreMissingEnv({ scenario, corpus, variant });
      break;
    case "port-conflict":
      checks = scorePortConflict({ scenario, corpus, variant });
      break;
    case "api-crash":
      checks = scoreApiCrash({ scenario, corpus });
      break;
    case "noisy-worker":
      checks = scoreNoisyWorker({ scenario, corpus, toolCalls });
      if (!checks.boundedToolUsage) {
        notes.push(`Tool calls exceeded scenario limit (${toolCalls}/${scenario.limits.maxToolCalls}).`);
      }
      break;
    default:
      throw new Error(`Unsupported scenario '${scenario.id}'.`);
  }

  const values = Object.values(checks);
  const passedChecks = values.filter(Boolean).length;

  return {
    scenario: scenario.id,
    variant,
    passed: passedChecks === values.length,
    checks,
    passedChecks,
    totalChecks: values.length,
    notes,
    derived: buildDerivedMetrics(corpus),
  };
}
