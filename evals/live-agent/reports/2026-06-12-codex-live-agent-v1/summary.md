# DevDeck Live Agent Evaluation

## Environment

- Date: 2026-06-12T23:31:20.119Z
- Git SHA: fcc33f71192cff7aedee2831a3bf68865d444163
- Agent: codex
- Codex CLI: codex (codex-cli 0.125.0)
- Primary tokenizer: tiktoken-o200k_base

## Results

| Scenario | Variant | Passed | Transcript tokens | Tool calls | Turns | Duration |
|---|---|---:|---:|---:|---:|---:|
| api-crash | baseline-shell | yes | 2736 | 11 | 1 | 92s |
| api-crash | devdeck-agent | no | 8030 | 24 | 0 | 180s |
| noisy-worker | baseline-shell | no | 5857 | 34 | 1 | 170s |
| noisy-worker | devdeck-agent | yes | 10115 | 19 | 1 | 162s |

## Token Comparison

| Scenario | Baseline tokens | DevDeck tokens | Savings |
|---|---:|---:|---:|
| api-crash | 2736 | 8030 | -193.5% |
| noisy-worker | 5857 | 10115 | -72.7% |

## Interpretation

This is a live-agent evaluation. Transcript tokens are model-visible transcript approximations using `tiktoken-o200k_base`. Provider-reported usage is shown when available. Results are scenario-specific and should not be treated as universal claims.

