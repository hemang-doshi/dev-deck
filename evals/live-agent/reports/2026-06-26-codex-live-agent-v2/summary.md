# DevDeck Live Agent Evaluation

## Environment

- Date: 2026-06-26T10:55:30.992Z
- Git SHA: d662ac478467dbb4a36f1a275700b40a5a4abffd
- Agent: codex
- Codex CLI: codex (codex-cli 0.125.0)
- Primary tokenizer: tiktoken-o200k_base

## Results

| Scenario | Variant | Runs | Passed | Pass rate | Median transcript tokens | Median tool calls | Median duration | Median turns | Provider usage | Skipped |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| startup-success | baseline-shell | 1 | 1 | 100.0% | 13422 | 14 | 192s | 1 | 489862 | no |
| startup-success | devdeck-agent | 1 | 0 | 0.0% | 3766 | 5 | 75s | 1 | 156845 | no |
| missing-env | baseline-shell | 1 | 0 | 0.0% | 474 | 0 | 240s | 0 | n/a | no |
| missing-env | devdeck-agent | 1 | 0 | 0.0% | 21122 | 8 | 98s | 1 | 257976 | no |
| port-conflict | baseline-shell | 1 | 1 | 100.0% | 10607 | 7 | 101s | 1 | 262965 | no |
| port-conflict | devdeck-agent | 1 | 0 | 0.0% | 52006 | 10 | 154s | 1 | 365744 | no |
| api-crash | baseline-shell | 1 | 0 | 0.0% | 12917 | 15 | 121s | 1 | 310691 | no |
| api-crash | devdeck-agent | 1 | 0 | 0.0% | 349562 | 16 | 211s | 1 | 521384 | no |
| noisy-worker | baseline-shell | 1 | 1 | 100.0% | 6244 | 8 | 240s | 0 | n/a | no |
| noisy-worker | devdeck-agent | 1 | 0 | 0.0% | 209573 | 19 | 202s | 1 | 529139 | no |

## Variant Comparison

| Scenario | Baseline pass rate | DevDeck pass rate | Baseline median tokens | DevDeck median tokens | Token delta | Baseline calls | DevDeck calls | Call delta |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| startup-success | 100.0% | 0.0% | 13422 | 3766 | -9656 | 14 | 5 | -9 |
| missing-env | 0.0% | 0.0% | 474 | 21122 | 20648 | 0 | 8 | 8 |
| port-conflict | 100.0% | 0.0% | 10607 | 52006 | 41399 | 7 | 10 | 3 |
| api-crash | 0.0% | 0.0% | 12917 | 349562 | 336645 | 15 | 16 | 1 |
| noisy-worker | 100.0% | 0.0% | 6244 | 209573 | 203329 | 8 | 19 | 11 |

## Interpretation

This is a live-agent evaluation. Transcript tokens are local transcript approximations using `tiktoken-o200k_base`. Provider-reported usage is shown only when Codex CLI exposes it. Deterministic benchmark results remain the CLI-regression layer; these live results measure real agent behavior on the same fixture family.
