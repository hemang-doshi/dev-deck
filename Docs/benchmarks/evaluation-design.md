# Benchmark Evaluation Design

Transcript size is one measurement layer, not a complete judgment of DevDeck.

## Evaluation Layers

1. **Transcript/output compression** measures agent-visible characters and tokens for equivalent tasks.
2. **Scenario outcome scoring** checks whether the expected failure, warning, recovery action, and final state were observed.
3. **Diagnosis cost** measures the commands and context required to identify a failed service and root cause.
4. **Recovery cost** measures the commands and context required to apply a recovery action and verify the result.
5. **Repeated context growth** measures how observation cost accumulates across noisy or iterative debugging sessions.
6. **Future live-agent loop measurement** will use provider-reported usage for complete prompt, response, and tool-observation accounting.

## Scenario Metadata

Scenario expectations live under `benchmarks/scenarios/`. Each file defines:

- the scenario purpose
- what the scenario measures
- expected failure or warning evidence
- expected recovery action
- expected final state

The scripted evaluator compares generated transcripts, command sequences, observations, logs, and run results with that metadata. It writes `evaluation.json` for each mode and `evaluation-summary.json` for the scenario.

These checks are intentionally deterministic. They verify that a benchmark run completed the scripted task; they do not score model reasoning quality.

## Interpretation

DevDeck should not be judged only by whether one command transcript is shorter than a clean manual shell transcript. Happy-path orchestration may add overhead. The more relevant evaluation includes whether bounded commands control repeated context growth and support diagnosis, recovery, and final verification under noisy or failing conditions.

See [Token Counting](token-counting.md) for local tokenizer and fallback rules.
