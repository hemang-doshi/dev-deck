function normalize(text) {
  return String(text).toLowerCase();
}

function includesAny(text, candidates) {
  const corpus = normalize(text);
  return candidates.some((candidate) => corpus.includes(normalize(candidate)));
}

function matches(text, pattern) {
  return pattern.test(normalize(text));
}

export function scoreRun({ scenario, variant, transcript, finalAnswer, toolCalls }) {
  const corpus = `${transcript}\n${finalAnswer}`;
  let checks;
  const notes = [];

  if (scenario.id === "api-crash") {
    checks = {
      failedServiceIdentified:
        includesAny(corpus, [
          `failed service: ${scenario.expected.failedService}`,
          "failed service api",
          "service: api",
          "api failed",
        ]) ||
        matches(corpus, /failed service:\s*`?api`?/),
      rootCauseIdentified: includesAny(corpus, [scenario.expected.rootCauseContains]),
      recoveryActionTaken:
        includesAny(corpus, [
          scenario.expected.recoveryActionContains,
          "restart api",
          "restarted api",
          "devdeck service restart api",
        ]) ||
        matches(corpus, /restart(?:ed|ing)?(?:\s+\w+){0,4}\s+api/) ||
        matches(corpus, /api(?:\s+\w+){0,4}\s+restart(?:ed|ing)?/),
      finalHealthVerified: includesAny(corpus, [
        scenario.expected.finalHealthContains,
        "final health result: ok",
        "final health: ok",
        "health result: ok",
      ]),
    };
  } else if (scenario.id === "noisy-worker") {
    checks = {
      warningIdentified: includesAny(corpus, [scenario.expected.warningContains]),
      noFalseFailedServiceClaim: !includesAny(corpus, [
        "failed service: api",
        "failed service: worker",
        "service failed",
      ]),
      finalHealthVerified: includesAny(corpus, [
        scenario.expected.finalHealthContains,
        "final health result: ok",
        "final health: ok",
        "services are otherwise running",
      ]),
      boundedLogUsage: toolCalls <= scenario.limits.maxToolCalls,
    };
    if (!checks.boundedLogUsage) {
      notes.push(`Tool calls exceeded scenario limit (${toolCalls}/${scenario.limits.maxToolCalls}).`);
    }
  } else {
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
  };
}
