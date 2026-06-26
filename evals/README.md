# Evaluations

`evals/` contains optional evaluation harnesses that measure agent task-completion behavior rather than CLI transcript regressions.

Current harnesses:

- `live-agent/`: live or smoke agent evaluations that compare raw shell debugging against DevDeck-guided debugging on the same fixture and scenario.

This is separate from `benchmarks/`:

- `benchmarks/` measures deterministic scripted workflows and output/token regressions.
- `evals/live-agent/` measures live agent behavior, deterministic scoring, transcript token approximations, repeat-aware medians and pass rates, and provider usage when the agent runtime exposes it.

Live Codex execution is optional. If Codex CLI auth or non-interactive execution is unavailable, the harness records an explicit skip instead of inventing results.

The deterministic matrix is the CLI contract regression layer. The live-agent harness is the real behavior layer.

Published live-agent proof artifacts:

- [2026-06-12 Codex live-agent v1](live-agent/reports/2026-06-12-codex-live-agent-v1/summary.md)
- [2026-06-26 Codex live-agent v2](live-agent/reports/2026-06-26-codex-live-agent-v2/summary.md)
