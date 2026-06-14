const cannedRuns = {
  "startup-success:baseline-shell": {
    transcript: `$ npm run scenario:startup-success
Applied scenario startup-success: Everything starts cleanly with realistic startup ordering and steady background activity.

$ npm run start:postgres
postgres ready on 15432

$ npm run start:redis
redis ready on 16379

$ npm run start:mock-external-api
mock external api ready on 4500

$ npm run start:api
api ready on 4000

$ npm run start:worker
worker ready

$ npm run start:scheduler
scheduler ready

$ npm run start:web
web ready on 3000

$ npm run health
{"ok":true,"services":{"web":"healthy","api":"healthy","worker":"running","scheduler":"running"}}

$ npm run cleanup
cleanup complete
`,
    finalAnswer: `failed service: none
root cause: none
recovery action taken: none
final health result: running and healthy`,
    toolCalls: 9,
    turns: 4,
  },
  "startup-success:devdeck-agent": {
    transcript: `$ devdeck start --agent --wait 30
START ok project=complex-saas-stack services=7 running=7 degraded=0 elapsed=5.1s
STATE running services=7 healthy=7 warnings=0 errors=0
NEXT none

$ devdeck status --agent
STATE running services=7 healthy=7 warnings=0 errors=0
SERVICES all_ready
NEXT none

$ devdeck stop --agent
STOP ok services=7 stopped=7 elapsed=1.8s
NEXT none
`,
    finalAnswer: `failed service: none
root cause: none
recovery action taken: none
final health result: running and healthy before clean stop`,
    toolCalls: 3,
    turns: 3,
  },
  "missing-env:baseline-shell": {
    transcript: `$ npm run scenario:missing-env
Applied scenario missing-env: The API fails early because required environment values are missing.

$ npm run start:postgres
postgres ready on 15432

$ npm run start:redis
redis ready on 16379

$ npm run start:mock-external-api
mock external api ready on 4500

$ npm run start:api
ERROR missing required env DATABASE_URL
ERROR missing required env SESSION_SECRET

$ npm run cleanup
cleanup complete
`,
    finalAnswer: `failed service: api
root cause: missing required env DATABASE_URL and SESSION_SECRET
recovery action taken: none
final health result: degraded`,
    toolCalls: 6,
    turns: 3,
  },
  "missing-env:devdeck-agent": {
    transcript: `$ devdeck start --agent --wait 30
START degraded project=complex-saas-stack services=7 running=6 degraded=1 elapsed=2.4s
DIAG degraded root=missing_env svc=api conf=0.95
CAUSE api missing required environment variable DATABASE_URL
E ERROR api "missing required env DATABASE_URL"
NEXT devdeck stop --agent # cleanup failed startup

$ devdeck stop --agent
STOP ok services=6 stopped=6 elapsed=1.4s
NEXT none
`,
    finalAnswer: `failed service: api
root cause: missing required env DATABASE_URL
recovery action taken: none
final health result: degraded startup cleaned up`,
    toolCalls: 2,
    turns: 2,
  },
  "port-conflict:baseline-shell": {
    transcript: `$ npm run scenario:port-conflict
Applied scenario port-conflict: A helper process occupies the API port before startup.

$ npm run start:postgres
postgres ready on 15432

$ npm run start:redis
redis ready on 16379

$ npm run start:mock-external-api
mock external api ready on 4500

$ npm run start:api
Error: listen EADDRINUSE: address already in use 127.0.0.1:4000

$ npm run cleanup
cleanup complete
`,
    finalAnswer: `failed service: api
root cause: EADDRINUSE on port 4000
recovery action taken: none
final health result: degraded`,
    toolCalls: 6,
    turns: 3,
  },
  "port-conflict:devdeck-agent": {
    transcript: `$ devdeck start --agent --wait 30
START degraded project=complex-saas-stack services=7 running=6 degraded=1 elapsed=2.2s
DIAG degraded root=port_conflict svc=api conf=0.94
CAUSE api failed to bind port 4000 because the address is already in use
E ERROR api "listen EADDRINUSE: address already in use 127.0.0.1:4000"
NEXT devdeck stop --agent # cleanup failed startup

$ devdeck stop --agent
STOP ok services=6 stopped=6 elapsed=1.2s
NEXT none
`,
    finalAnswer: `failed service: api
root cause: EADDRINUSE on port 4000
recovery action taken: none
final health result: degraded startup cleaned up`,
    toolCalls: 2,
    turns: 2,
  },
  "api-crash:baseline-shell": {
    transcript: `$ npm run scenario:api-crash-after-start
Applied scenario api-crash-after-start: The API becomes ready, serves briefly, then crashes with deterministic runtime evidence.

$ npm run start:postgres
postgres ready on 15432

$ npm run start:redis
redis ready on 16379

$ npm run start:mock-external-api
mock external api ready on 4500

$ npm run start:api
api ready on 4000

$ npm run start:worker
worker ready

$ npm run start:scheduler
scheduler ready

$ npm run start:web
web ready on 3000

$ npm run health
{"ok":true,"services":{"web":"healthy","api":"healthy","worker":"running","scheduler":"running"}}

$ tail -n 20 .fixture-state/logs/api.log
ERROR simulated crash after startup
api exiting with code 1

$ npm run start:api
api ready on 4000

$ npm run health
{"ok":true,"services":{"web":"healthy","api":"healthy","worker":"running","scheduler":"running"}}

$ npm run cleanup
cleanup complete
`,
    finalAnswer: `failed service: api
root cause: simulated crash after startup
recovery action taken: restart api
final health result: running and healthy`,
    toolCalls: 11,
    turns: 5,
  },
  "api-crash:devdeck-agent": {
    transcript: `$ devdeck start --agent --wait 30
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

$ devdeck stop --agent
STOP ok services=7 stopped=7 elapsed=1.7s
NEXT none
`,
    finalAnswer: `failed service: api
root cause: simulated crash after startup
recovery action taken: devdeck recover --agent --wait 30
final health result: api running healthy after targeted restart`,
    toolCalls: 4,
    turns: 3,
  },
  "noisy-worker:baseline-shell": {
    transcript: `$ npm run scenario:noisy-worker
Applied scenario noisy-worker: The stack remains healthy while the worker emits deterministic high-volume benign logs and periodic warnings.

$ npm run start:postgres
postgres ready on 15432

$ npm run start:redis
redis ready on 16379

$ npm run start:mock-external-api
mock external api ready on 4500

$ npm run start:api
api ready on 4000

$ npm run start:worker
worker ready

$ npm run start:scheduler
scheduler ready

$ npm run start:web
web ready on 3000

$ npm run health
{"ok":true,"services":{"web":"healthy","api":"healthy","worker":"running","scheduler":"running"}}

$ grep -i warning .fixture-state/logs/worker.log | tail -n 5
warning: queue latency above threshold

$ npm run cleanup
cleanup complete
`,
    finalAnswer: `failed service: none
root cause: none
recovery action taken: none
final health result: running and healthy
warning signal: queue latency above threshold`,
    toolCalls: 10,
    turns: 3,
  },
  "noisy-worker:devdeck-agent": {
    transcript: `$ devdeck start --agent --wait 30
START ok project=complex-saas-stack services=7 running=7 degraded=0 elapsed=5.2s
STATE running services=7 healthy=7 warnings=0 errors=0
NEXT none

$ devdeck logs worker --agent --severity warning --tail 40
LOGS worker matched=2 returned=2 omitted=0
E WARNING worker "queue latency above threshold"
NEXT devdeck status --agent # confirm services remain healthy

$ devdeck status --agent
STATE running services=7 healthy=7 warnings=1 errors=0
SERVICES all_ready
NEXT none

$ devdeck stop --agent
STOP ok services=7 stopped=7 elapsed=1.6s
NEXT none
`,
    finalAnswer: `failed service: none
root cause: none
recovery action taken: none
final health result: running and healthy
warning signal: queue latency above threshold`,
    toolCalls: 4,
    turns: 4,
  },
};

export async function runShellAgentSmoke({ scenario, variant }) {
  const key = `${scenario.id}:${variant}`;
  const run = cannedRuns[key];
  if (!run) {
    throw new Error(`Missing canned smoke run for ${key}.`);
  }
  return {
    agent: "smoke",
    model: "canned",
    transcript: run.transcript,
    finalAnswer: run.finalAnswer,
    toolCalls: run.toolCalls,
    turns: run.turns,
    exitCode: 0,
    providerUsage: null,
    providerUsageReason: "Smoke mode uses canned transcripts only.",
  };
}
