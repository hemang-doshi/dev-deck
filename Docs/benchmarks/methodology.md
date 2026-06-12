# Benchmark Methodology

This document defines how DevDeck benchmark claims should be produced and verified.

## Goal

Measure whether DevDeck reduces agent-visible runtime and debugging context compared with unmanaged terminal workflows.

## Comparison Shape

Compare at least two workflows:

1. Raw multi-terminal service management.
2. DevDeck-managed service orchestration using bounded commands such as `start`, `status`, `logs`, and `snapshot`.

## Metrics

- total tokens exposed to the agent during runtime setup
- total tokens exposed during debugging
- number of terminal interactions required
- time-to-state-inspection for a representative failure

## Token Accounting

For each run, record:

```txt
total_agent_visible_tokens =
  prompt_tokens
+ model_output_tokens
+ tool_observation_tokens
```

Then calculate:

```txt
token_savings_percent =
  ((baseline_tokens - devdeck_tokens) / baseline_tokens) * 100
```

## Current Harness

The initial benchmark harness lives in:

`benchmarks/`

The v0 fixture is:

`benchmarks/fixtures/node-api-worker`

The harness compares:

1. unmanaged raw process orchestration
2. DevDeck-managed orchestration using bounded commands

v0 uses approximate token counting based on character count divided by four.

Future versions may add model-specific tokenizers.

## First Published Fixture

The first benchmark report is:

`benchmarks/reports/v1.3.0-node-api-worker-v0/summary.md`

It uses the `node-api-worker` fixture and approximate token counting.

## Rules

- Use the same application stack in both conditions.
- Use the same task prompts and failure scenarios.
- Record exact commands used.
- Preserve raw transcripts for auditability.
- Report methodology separately from conclusions.

## Required Disclosure

Every published benchmark must include:

- DevDeck version
- operating system
- Node.js version
- project fixture
- services managed
- agent used
- model used
- raw command transcript
- token counting method
- benchmark date

## Status

The first published v1.3 benchmark result is fixture-specific and intentionally modest in scope.

This methodology remains the source of truth for how future benchmark claims should be produced.
