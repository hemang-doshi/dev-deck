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
npm run benchmark:v0
```

The one-command runner writes a timestamped directory under `benchmarks/results/` and performs the baseline workflow, the DevDeck workflow, approximate token counting, and summary generation.

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
