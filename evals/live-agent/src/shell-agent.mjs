const cannedRuns = {
  "api-crash:baseline-shell": {
    transcript: `$ npm run api
api listening on http://127.0.0.1:3100

$ npm run worker
worker booted

$ curl --silent http://127.0.0.1:3100/health
{"ok":true,"service":"api"}

$ tail -n 20 api.log
ERROR database connection lost
api exiting with code 1

$ npm run api
api listening on http://127.0.0.1:3100

$ curl --silent http://127.0.0.1:3100/health
{"ok":true,"service":"api"}
`,
    finalAnswer: `failed service: api
root cause: database connection lost
recovery action taken: restart api
final health result: {"ok":true,"service":"api"}`,
    toolCalls: 6,
    turns: 4,
  },
  "api-crash:devdeck-agent": {
    transcript: `$ devdeck start
Deck started

$ devdeck status --agent
STATE running svc=2 fail=0 bad=0 warn=0 err=0
SERVICES all_ready
NEXT none

$ devdeck snapshot --agent
STATE degraded svc=2 fail=1 bad=1 warn=0 err=1
I error api service_failed "database connection lost"
E error api "ERROR database connection lost"
NEXT devdeck service restart api # failed service

$ devdeck service restart api
service api restarted

$ devdeck status --agent
STATE running svc=2 fail=0 bad=0 warn=0 err=0
SERVICES all_ready
NEXT none
`,
    finalAnswer: `failed service: api
root cause: database connection lost
recovery action taken: restart api
final health result: {"ok":true,"service":"api"}`,
    toolCalls: 5,
    turns: 3,
  },
  "noisy-worker:baseline-shell": {
    transcript: `$ npm run api
api listening on http://127.0.0.1:3100

$ npm run worker
worker booted

$ curl --silent http://127.0.0.1:3100/health
{"ok":true,"service":"api"}

$ grep -i warning worker.log
warning: queue latency above threshold

$ tail -n 10 worker.log
warning: queue latency above threshold
`,
    finalAnswer: `failed service: none
root cause: none
recovery action taken: none
final health result: {"ok":true,"service":"api"}
warning signal: queue latency above threshold`,
    toolCalls: 5,
    turns: 3,
  },
  "noisy-worker:devdeck-agent": {
    transcript: `$ devdeck start
Deck started

$ devdeck status --agent
STATE running svc=2 fail=0 bad=0 warn=0 err=0
SERVICES all_ready
NEXT none

$ devdeck logs worker --agent --grep warning --tail 30
LOGS worker matched=2 returned=1 omitted=1
E warning worker "queue latency above threshold" x2
NEXT none

$ devdeck status --agent
STATE running svc=2 fail=0 bad=0 warn=1 err=0
SERVICES all_ready
NEXT none
`,
    finalAnswer: `failed service: none
root cause: none
recovery action taken: none
final health result: {"ok":true,"service":"api"}
warning signal: queue latency above threshold`,
    toolCalls: 4,
    turns: 3,
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
