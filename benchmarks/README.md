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
node benchmarks/scripts/run-scenario.mjs api-crash --mode devdeck-agent-full
```

`benchmark:v0` preserves the first simple fixture report.

`benchmark:realism` runs scenario-based comparisons that are closer to DevDeck's actual product claim: reducing context growth during noisy or failing local development sessions. It now compares older full-state modes with compact `--agent` modes.

For actual live agent task-completion evaluation, use `evals/live-agent/`. The benchmark scripts in this directory remain deterministic and fast; they are not a substitute for live-agent behavior measurement.

Each scenario run writes raw transcripts, per-command tokenizer attribution, local real and approximate token counts, per-mode evaluation results, and a scenario-aware summary under `benchmarks/results/`. The realism runner adds `matrix-results.json` and `matrix-summary.md`.

The newer complex-stack product-validation harness is documented in [product-validation.md](product-validation.md). It runs the `complex-saas-stack` fixture in `manual-runtime` and `devdeck-current` modes without replacing the older `node-api-worker` flows.

## Published Reports

- [v1.3.0 node-api-worker v0](reports/v1.3.0-node-api-worker-v0/summary.md)

If you want to run each step manually:

```bash
node benchmarks/scripts/run-baseline.mjs
node benchmarks/scripts/run-devdeck.mjs --run-dir benchmarks/results/<run-id>
node benchmarks/scripts/count-tokens.mjs benchmarks/results/<run-id>
node benchmarks/scripts/summarize-results.mjs benchmarks/results/<run-id>
```

## Measurement

New local runs use `tiktoken-o200k_base` as the primary tokenizer. They also report `tiktoken-cl100k_base` and the approximate formula:

```txt
approx_tokens = ceil(character_count / 4)
```

The first published v0 report remains an approximate-only historical artifact. New reports must state their primary tokenizer. See [Token Counting](../Docs/benchmarks/token-counting.md) and [Evaluation Design](../Docs/benchmarks/evaluation-design.md).

## Rules

Do not publish benchmark numbers without including:

- fixture
- environment
- raw transcripts
- token counting method
- date

Committed proof artifacts belong under `benchmarks/reports/`.
Generated local runs stay under `benchmarks/results/`.

Live-agent proof artifacts belong under `evals/live-agent/reports/`.

See [Interpreting Benchmark Results](../Docs/benchmarks/interpreting-results.md) before drawing conclusions from a single fixture or scenario.
