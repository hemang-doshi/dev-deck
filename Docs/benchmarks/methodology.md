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

Reproducible v1.3 benchmark results have not been published yet.

This file exists so future benchmark claims can point to a stable methodology first.
