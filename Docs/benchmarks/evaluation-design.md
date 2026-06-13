# Benchmark Evaluation Design

Transcript size is one measurement layer, not a complete judgment of DevDeck.

## Evaluation Layers

1. **Transcript/output compression** measures agent-visible characters and tokens for equivalent tasks.
2. **Scenario outcome scoring** checks whether the expected failure, warning, recovery action, and final state were observed.
3. **Diagnosis cost** measures the commands and context required to identify a failed service and root cause.
4. **Recovery cost** measures the commands and context required to apply a recovery action and verify the result.
5. **Repeated context growth** measures how observation cost accumulates across noisy or iterative debugging sessions.
6. **Live-agent loop measurement** lives under `evals/live-agent/` and uses provider-reported usage only when the runtime exposes it.

## Scenario Metadata

Scenario expectations live under `benchmarks/scenarios/`. Each file defines:

- the scenario purpose
- what the scenario measures
- expected failure or warning evidence
- expected recovery action
- expected final state

The scripted evaluator compares generated transcripts, command sequences, observations, logs, and run results with that metadata. It writes `evaluation.json` for each mode and `evaluation-summary.json` for the scenario.

These checks are intentionally deterministic. They verify that a benchmark run completed the scripted task; they do not score model reasoning quality.

Current realism runs compare older full-state modes with compact `--agent` modes so transcript reduction can be measured without changing the scripted recovery task.

## Live-Agent Evaluation

The live-agent harness is intentionally separate from deterministic benchmarks.

It compares:

- same fixture
- same scenario
- same task prompt
- same agent runtime
- baseline shell workflow versus DevDeck workflow

The live harness scores task completion deterministically from transcripts and final answers. It records transcript-token approximations with `tiktoken-o200k_base` and stores provider usage separately when available.

If Codex CLI auth or supported non-interactive execution is unavailable, the live harness writes an explicit skip artifact instead of fabricating results.

## Interpretation

DevDeck should not be judged only by whether one command transcript is shorter than a clean manual shell transcript. Happy-path orchestration may add overhead. The more relevant evaluation includes whether bounded commands control repeated context growth and support diagnosis, recovery, and final verification under noisy or failing conditions.

See [Token Counting](token-counting.md) for local tokenizer and fallback rules.
