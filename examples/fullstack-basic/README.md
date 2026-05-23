# Fullstack Basic Example

This example is a self-contained local stack for exercising the DevDeck MVP.

## Services

- `frontend.mjs` starts a small HTTP server on port `3000`
- `backend.mjs` starts an API-like HTTP server on port `4000`, emits a warning, then exits with an intentional error
- `worker.mjs` emits steady background job logs and periodic warnings

## Run

```bash
node ../../packages/cli/dist/index.js dev
```

The included [`devdeck.yml`](/Users/hemangdoshi/Developer/dev-deck/examples/fullstack-basic/devdeck.yml) is ready to use as-is.
