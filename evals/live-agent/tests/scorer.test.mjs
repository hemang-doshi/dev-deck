import test from "node:test";
import assert from "node:assert/strict";

import { loadScenario } from "../src/scenarios.mjs";
import { scoreRun } from "../src/scorer.mjs";

test("scoreRun accepts devdeck recover output for api-crash", async () => {
  const scenario = await loadScenario("api-crash");
  const transcript = `$ devdeck start --agent --wait 30
START ok project=complex-saas-stack services=7 running=7 degraded=0 elapsed=5.0s
STATE running services=7 healthy=7 warnings=0 errors=0
NEXT none

$ devdeck status --agent
STATE degraded services=7 healthy=6 warnings=0 errors=1
I ERROR api service_failed "simulated crash after startup"
NEXT devdeck recover --agent --wait 30 # targeted restart and verification

$ devdeck recover --agent --wait 30
RECOVER ok root=service_crash svc=api action=restart elapsed=3.1s
CAUSE api exited after startup with non-zero code
E ERROR api "simulated crash after startup"
S api running ready=ready h=healthy r=1 issue=none
NEXT none # recovered
`;
  const finalAnswer = `failed service: api
root cause: simulated crash after startup
recovery action taken: devdeck recover --agent --wait 30
final health result: api running healthy after targeted restart`;

  const result = scoreRun({
    scenario,
    variant: "devdeck-agent",
    transcript,
    finalAnswer,
    toolCalls: 3,
  });

  assert.equal(result.passed, true);
  assert.equal(result.checks.recoveryActionTaken, true);
  assert.equal(result.derived.usedDevDeckRecover, true);
});

test("scoreRun keeps noisy-worker strict about false failure claims", async () => {
  const scenario = await loadScenario("noisy-worker");
  const transcript = `$ devdeck start --agent --wait 30
START ok project=complex-saas-stack services=7 running=7 degraded=0 elapsed=5.0s
STATE degraded services=7 healthy=6 warnings=1 errors=0
I ERROR worker service_failed "queue latency above threshold"
`;
  const finalAnswer = `failed service: worker
root cause: queue latency above threshold
recovery action taken: restart worker
final health result: running`;

  const result = scoreRun({
    scenario,
    variant: "devdeck-agent",
    transcript,
    finalAnswer,
    toolCalls: 4,
  });

  assert.equal(result.passed, false);
  assert.equal(result.checks.noFalseFailedServiceClaim, false);
});
