# Interpreting Benchmark Results

DevDeck benchmarks measure agent-visible command transcripts for controlled local development tasks. They are diagnostic evidence, not product-wide truth.

## Scenario Meaning

- Happy-path fixtures mostly measure orchestration overhead. A clean baseline can be smaller because little diagnosis is required.
- Noisy long-running logs measure context growth and the cost of finding relevant lines.
- Runtime failure scenarios measure diagnosis cost: identifying the failed service, finding the cause, choosing a recovery action, and verifying recovery.
- Multi-iteration debugging measures repeated observation cost. The same iteration count must be used in every compared mode.

## Negative Results

Negative token savings are useful. They can show that a workflow is redundant, that agent-facing output is too verbose, or that a benchmark does not represent the product claim being tested.

Do not treat one fixture or one scenario as product truth. Compare the command attribution and raw transcripts before drawing a conclusion.

## Evidence Standard

Strong comparative evidence requires:

- the same fixture
- the same injected failure or log behavior
- the same debugging iteration count
- the same token-counting method
- raw transcripts for every mode
- per-command output attribution
- scripted expected-outcome evaluation

The current harness uses `tiktoken-o200k_base` as the primary local tokenizer and reports `tiktoken-cl100k_base` plus the historical approximation:

```txt
approx_tokens = ceil(character_count / 4)
```

Approximate counts are smoke-test and fallback data, not the primary metric for new local reports. Provider-reported usage remains the gold standard for future live-agent measurements.

Results remain fixture-specific even when those controls are held constant.

See [Benchmark Token Counting](token-counting.md) and [Benchmark Evaluation Design](evaluation-design.md) for the measurement and scoring contracts.
