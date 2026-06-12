# Benchmark Token Counting

DevDeck benchmark reports distinguish local transcript token estimates from provider-reported usage.

## Primary Local Counts

New local benchmark runs use `tiktoken-o200k_base` as the primary tokenizer. Reports also include:

- `tiktoken-cl100k_base`
- `approx-char-div-4`

Every report must name its primary tokenizer. Token counts can vary across models and tokenizer encodings, especially for JSON, paths, timestamps, and other structured output.

The tokenizer package runs locally. Normal benchmark runs do not require an OpenAI API key or make tokenizer network calls.

## Approximate Fallback

The approximate tokenizer uses:

```txt
ceil(character_count / 4)
```

This is useful for smoke tests and historical comparison, but it is not the primary measurement for new local reports. Explicitly select it with:

```bash
DEVDECK_BENCHMARK_TOKENIZER=approx-char-div-4 npm run benchmark:v0
```

Reports generated in fallback mode state:

```txt
Primary tokenizer: approx-char-div-4
```

If a real tokenizer is selected and the tokenizer package cannot load, the benchmark fails with an actionable error instead of silently substituting the approximation.

## Live Agent Usage

Provider-reported usage is the gold standard for live agent runs because it captures the provider's actual model tokenizer and request accounting. Local transcript counts remain useful for deterministic, offline comparisons, but they do not include prompt tokens, model output tokens, hidden protocol overhead, or provider-specific accounting.

See [Evaluation Design](evaluation-design.md) for how token counts fit into the broader benchmark.
