# v1.3.0 node-api-worker v0

This folder contains the first committed benchmark proof artifact for DevDeck v1.3.0.

Contents:

- `summary.md`: published fixture-specific result summary
- `token-count.json`: approximate token count metadata and computed result
- `baseline-transcript.redacted.txt`: curated baseline transcript with local machine details redacted
- `devdeck-transcript.redacted.txt`: curated DevDeck transcript with local machine details redacted

This result uses approximate token counting via `ceil(character_count / 4)`.
It is a fixture-specific result, not a universal claim.
It is preserved as the historical first approximate report; future reports use real local tokenizer counts as their primary metric.
