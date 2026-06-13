# Product Validation Harness

This benchmark layer measures the new `complex-saas-stack` fixture without changing the older `node-api-worker` harness.

## Modes

- `manual-runtime`
- `devdeck-current`

## Scenarios

- `startup-success`
- `missing-env`
- `port-conflict`
- `api-crash-after-start`
- `noisy-worker`

## Run one scenario

```bash
node benchmarks/scripts/run-product-validation.mjs startup-success --mode manual-runtime
node benchmarks/scripts/run-product-validation.mjs startup-success --mode devdeck-current
```

## Run the full matrix

```bash
node benchmarks/scripts/run-product-validation-matrix.mjs
```

Each run writes mode-specific transcripts, command events, evaluation output, and service logs under:

```txt
benchmarks/results/product-validation/<timestamp>/<scenario>/<mode>/
```

The matrix runner also writes:

```txt
benchmarks/results/product-validation/<timestamp>/matrix-results.json
benchmarks/results/product-validation/<timestamp>/matrix-summary.md
```

This harness does not claim provider-reported token savings. It only builds deterministic local measurement infrastructure for the complex stack fixture.

Interpret the matrix carefully:

- A faster failing run is not a product win.
- The benchmark should distinguish successful fast paths from actionable fast failures and from non-actionable fast failures.
