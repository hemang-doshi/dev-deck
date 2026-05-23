# DevDeck Phase 3 Execution Plan

1. Write core tests for bounded log retention, event ordering, process exits, missing `cwd`, invalid commands, restart bookkeeping, and clean shutdown.
   Verify: `npm run test --workspace @devdeck/core`
2. Implement the process runner, log buffer, and service session state in `@devdeck/core`.
   Verify: core tests pass and `npm run build --workspace @devdeck/core` succeeds.
3. Wire `devdeck dev` to the session runtime only after the core contracts are stable.
   Verify: manual CLI runs can start and stop services cleanly.
