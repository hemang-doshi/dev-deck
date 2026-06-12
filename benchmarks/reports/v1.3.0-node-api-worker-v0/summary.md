# DevDeck Benchmark Run

## Fixture

node-api-worker

## Environment

- OS: darwin 25.5.0
- Node: v26.0.0
- DevDeck: 1.3.0
- Date: 2026-06-12T20:05:16.271Z

## Baseline

- Commands: 9
- Transcript characters: 626
- Approx tokens: 157

## DevDeck

- Commands: 7
- Transcript characters: 4051
- Approx tokens: 1013

## Command Sequences

### Baseline

1. npm run api
2. npm run worker
3. curl http://127.0.0.1:3100/health
4. ps -p <api-pid>,<worker-pid> -o pid=,state=,command=
5. tail -n 20 baseline/api.log
6. tail -n 20 baseline/worker.log
7. kill <api-pid>
8. npm run api
9. curl http://127.0.0.1:3100/health

### DevDeck

1. devdeck start
2. devdeck status --json
3. devdeck logs api --tail 80
4. devdeck logs worker --tail 80
5. devdeck snapshot
6. devdeck service restart api
7. devdeck stop

## Files

- baseline transcript: `baseline-transcript.redacted.txt`
- DevDeck transcript: `devdeck-transcript.redacted.txt`
- token count: `token-count.json`

## Result

Approx token savings: -545.22%

## Interpretation

This benchmark measures agent-visible command transcript size for one fixture.
It does not claim universal token savings across all projects.

## Caveats

- Historical report: this run predates real-tokenizer benchmark metrics.
- Approximate token counting only. Not model-specific.
- This result uses approximate token counting via `ceil(character_count / 4)`.
- It is a fixture-specific result, not a universal claim.
