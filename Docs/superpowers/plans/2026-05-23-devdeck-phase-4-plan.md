# DevDeck Phase 4 Execution Plan

1. Write server tests for initial snapshot, log fanout, reconnect state, action acknowledgements, health, and asset serving.
   Verify: `npm run test --workspace @devdeck/server`
2. Implement the local HTTP/WebSocket session server with in-memory session fanout only.
   Verify: `npm run build --workspace @devdeck/server`
3. Update `devdeck dev` to start the session server, expose the dashboard URL, and honor whole-session shutdown from either terminal signals or server actions.
   Verify: manual CLI checks and `curl http://localhost:4545/health`.
