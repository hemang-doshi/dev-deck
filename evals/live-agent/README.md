# Live Agent Evaluation Harness

This harness compares two debugging styles against the same local fixture and scenario:

- `baseline-shell`: raw shell commands only
- `devdeck-agent`: DevDeck-first debugging with the bounded v1.4.6 runtime loop

It is intentionally separate from `benchmarks/`.

- `benchmarks/` checks deterministic CLI-output and scripted workflow regressions.
- `evals/live-agent/` checks whether an actual agent reaches the right diagnosis and recovery with fewer transcript tokens, fewer tool calls, fewer wrong turns, and faster bounded recovery.

## Commands

```bash
npm run eval:agent:smoke
npm run eval:agent:codex
npm run eval:agent:codex -- --scenario api-crash
npm run eval:agent:codex -- --scenario api-crash --repeats 3
npm run eval:agent:codex -- --repeats 3
```

## Scenario Set

The live harness now covers the same scenario family as the deterministic product-validation matrix:

- `startup-success`
- `missing-env`
- `port-conflict`
- `api-crash`
- `noisy-worker`

The harness uses the `complex-saas-stack` fixture and applies the matching scenario setup before each repeat.

## Modes

### `smoke`

Does not invoke Codex.

It verifies:

- scenario loading
- prompt loading
- tokenizer counting
- deterministic scoring
- repeat-aware report generation

### `codex`

Attempts a real non-interactive Codex CLI run.

Requirements:

- `codex` CLI installed
- working Codex authentication
- `codex exec` non-interactive support

If any requirement is unavailable, the harness writes a skip report and does not fabricate results.

If Codex CLI authentication or non-interactive execution fails, the report is published as a skip rather than a fake pass/fail result.

## Outputs

Each run writes under `evals/live-agent/results/<timestamp>/`:

- `metadata.json`
- per-scenario, per-variant, per-repeat transcripts, run metadata, and deterministic scores
- `summary.json`
- `summary.md`

If Codex execution is skipped, the run directory also contains `codex-skipped.md`.

Committed proof artifacts belong under `evals/live-agent/reports/`. Raw transcripts stay in `results/` unless they are explicitly safe to publish.

Published reports use aggregate pass rate and median metrics. Raw per-run artifacts remain in `results/`.

Current published proof artifacts:

- [2026-06-12 Codex live-agent v1](reports/2026-06-12-codex-live-agent-v1/summary.md)
- [2026-06-26 Codex live-agent v2](reports/2026-06-26-codex-live-agent-v2/summary.md)

The June 26, 2026 v2 report is the current real-agent proof snapshot for the bounded recovery loop. It captures real Codex behavior on the `complex-saas-stack` fixture, including cases where sandbox restrictions prevented a clean DevDeck session from becoming reachable. Keep that context with the report; it is evidence, not a universal claim.

## Metrics

- `transcriptTokens` uses `tiktoken-o200k_base` as a local transcript approximation.
- `providerUsage` is recorded only when Codex CLI emits it.
- `wrongTurns`, `usedDevDeckRecover`, `usedRawLogs`, `timeToDiagnosis`, and `timeToRecovery` are derived from transcript evidence when available.

These are different metrics. Transcript tokens must not be treated as provider-billed usage.

## DevDeck Prompt Contract

The `devdeck-agent` variant teaches this bounded loop:

- `devdeck start --agent --wait 30`
- reuse inline `DIAG` when startup already explains the failure
- `devdeck diagnose --agent` only when the root cause is still unclear
- `devdeck recover --agent --wait 30` for restartable degraded services
- `devdeck status --agent` and `devdeck logs <service> --agent --tail 80` only when needed
- `devdeck stop --agent` at the end
