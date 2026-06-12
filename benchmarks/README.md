# DevDeck Benchmarks

This folder contains reproducible benchmark fixtures for measuring whether DevDeck reduces agent-visible runtime and debugging context compared with raw terminal workflows.

## Current Fixture

### `node-api-worker`

A tiny two-service Node.js stack:

- API service
- worker service

## Run

```bash
npm install
npm run build
npm run benchmark:validate
npm run benchmark:v0
npm run benchmark:realism
node benchmarks/scripts/run-scenario.mjs api-crash --mode devdeck-full
```

`benchmark:v0` preserves the first simple fixture report.

`benchmark:realism` runs scenario-based comparisons that are closer to DevDeck's actual product claim: reducing context growth during noisy or failing local development sessions.

Each scenario run writes raw transcripts, per-command events, command attribution, approximate token counts, and a scenario-aware summary under `benchmarks/results/`. The realism runner adds `matrix-results.json` and `matrix-summary.md`.

## Published Reports

- [v1.3.0 node-api-worker v0](reports/v1.3.0-node-api-worker-v0/summary.md)

If you want to run each step manually:

```bash
node benchmarks/scripts/run-baseline.mjs
node benchmarks/scripts/run-devdeck.mjs --run-dir benchmarks/results/<run-id>
node benchmarks/scripts/count-tokens.mjs benchmarks/results/<run-id>
node benchmarks/scripts/summarize-results.mjs benchmarks/results/<run-id>
```

## Token Counting

v0 uses approximate token counting:

```txt
approx_tokens = ceil(character_count / 4)
```

## Rules

Do not publish benchmark numbers without including:

- fixture
- environment
- raw transcripts
- token counting method
- date

Committed proof artifacts belong under `benchmarks/reports/`.
Generated local runs stay under `benchmarks/results/`.

See [Interpreting Benchmark Results](../Docs/benchmarks/interpreting-results.md) before drawing conclusions from a single fixture or scenario.
