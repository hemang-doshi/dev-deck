# Live Agent Evaluation Harness

This harness compares two debugging styles against the same local fixture and scenario:

- `baseline-shell`: raw shell commands only
- `devdeck-agent`: DevDeck-first debugging with compact `--agent` commands

It is intentionally separate from `benchmarks/`.

- `benchmarks/` checks deterministic CLI-output and scripted workflow regressions.
- `evals/live-agent/` checks whether an actual agent reaches the right diagnosis and recovery with fewer transcript tokens, fewer tool calls, and fewer wrong turns.

## Commands

```bash
npm run eval:agent:smoke
npm run eval:agent:codex
npm run eval:agent:codex -- --scenario api-crash
```

## Modes

### `smoke`

Does not invoke Codex.

It verifies:

- scenario loading
- prompt loading
- tokenizer counting
- deterministic scoring
- report generation

### `codex`

Attempts a real non-interactive Codex CLI run.

Requirements:

- `codex` CLI installed
- working Codex authentication
- `codex exec` non-interactive support

If any requirement is unavailable, the harness writes a skip report and does not fabricate results.

## Outputs

Each run writes under `evals/live-agent/results/<timestamp>/`:

- `metadata.json`
- per-scenario and per-variant transcripts, run metadata, and deterministic scores
- `summary.json`
- `summary.md`

If Codex execution is skipped, the run directory also contains `codex-skipped.md`.

Committed proof artifacts belong under `evals/live-agent/reports/`. Raw transcripts stay in `results/` unless they are explicitly safe to publish.

## Metrics

- `transcriptTokens` uses `tiktoken-o200k_base` as a local transcript approximation.
- `providerUsage` is recorded only when Codex CLI emits it.

These are different metrics. Transcript tokens must not be treated as provider-billed usage.
