# Evaluations

`evals/` contains optional evaluation harnesses that measure agent task-completion behavior rather than CLI transcript regressions.

Current harnesses:

- `live-agent/`: live or smoke agent evaluations that compare raw shell debugging against DevDeck-guided debugging on the same fixture and scenario.

This is separate from `benchmarks/`:

- `benchmarks/` measures deterministic scripted workflows and output/token regressions.
- `evals/live-agent/` measures live agent behavior, deterministic scoring, transcript token approximations, and provider usage when the agent runtime exposes it.

Live Codex execution is optional. If Codex CLI auth or non-interactive execution is unavailable, the harness records an explicit skip instead of inventing results.
