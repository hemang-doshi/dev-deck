# Agent DevDeck CLI

Agent DevDeck keeps the existing `devdeck` binary and `devdeck.yml` config format, but adds a bounded CLI surface for local agents and terminal-first workflows.

## Core model

- `devdeck dev` remains the foreground session runner.
- When the session starts, DevDeck writes `.devdeck/session.json` with the active local URL and process metadata.
- Agent-facing commands read that runtime file first and fall back to `http://127.0.0.1:4545` when no session file exists.
- All commands print concise text by default and support `--json` where structured output is useful.

## Commands

```bash
devdeck agent setup
devdeck dev [--port PORT]
devdeck start [--port PORT]
devdeck status [--json] [--url URL]
devdeck logs [service] [--tail 80] [--severity info|warning|error] [--grep text] [--json] [--url URL]
devdeck snapshot [--tail 120] [--json] [--url URL]
devdeck stop [--url URL]
devdeck service start <name> [--url URL]
devdeck service stop <name> [--url URL]
devdeck service restart <name> [--url URL]
```

## Typical agent flow

1. Run `devdeck agent setup` to print the agent-readable setup prompt and starter YAML.
2. Create or update `devdeck.yml` for the repository.
3. Start the local stack with `devdeck dev` or `devdeck dev --port 5000`.
4. Query state with `devdeck status`, inspect targeted logs with `devdeck logs`, and collect a bounded markdown summary with `devdeck snapshot`.
5. Stop the session with `devdeck stop` or restart a single service with `devdeck service restart <name>`.

## Session file

Runtime discovery uses `.devdeck/session.json`:

```json
{
  "version": 1,
  "project": "my-app",
  "configPath": "/repo/devdeck.yml",
  "url": "http://127.0.0.1:4545",
  "port": 4545,
  "pid": 12345,
  "startedAt": "2026-05-23T00:00:00.000Z"
}
```

The file is removed on clean shutdown.
