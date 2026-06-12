# Why Agent-First?

Most development tools assume a human is watching terminals.

AI coding agents work differently.

They need:

- bounded outputs
- stable commands
- parseable state
- explicit error codes
- targeted logs
- repeatable control flows
- clean startup and shutdown

Raw terminals are noisy. They mix unrelated service output, stack traces, warnings, rebuild logs, and shell state into one stream.

That noise becomes expensive when an agent has to read it.

DevDeck turns local runtime state into a compact control surface.

Instead of asking an agent to inspect multiple terminals, DevDeck gives it commands like:

```bash
npx devdeck status --json
npx devdeck logs api --tail 80
npx devdeck snapshot
npx devdeck service restart api
```

The goal is not to hide information.

The goal is to expose the right amount of information at the right time.
