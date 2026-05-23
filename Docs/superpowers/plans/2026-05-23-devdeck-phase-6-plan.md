# DevDeck Phase 6 Execution Plan

1. Add tests for log classification, stack-trace detection, debug-context formatting, and export formatting in `@devdeck/core`.
   Verify: `npm run test --workspace @devdeck/core`
2. Add export and health-monitor behavior to the session server.
   Verify: `npm run test --workspace @devdeck/server`
3. Feed health and export capabilities into the eventual dashboard client instead of storing extra state elsewhere.
