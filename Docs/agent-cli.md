# DevDeck Agent CLI

DevDeck keeps the existing `devdeck` binary and `devdeck.yml` config format, but adds a bounded CLI surface for local agents and terminal-first workflows.

## Core model

- `devdeck dev` remains the foreground session runner.
- When the session starts, DevDeck writes `.devdeck/session.json` with the active local URL and process metadata.
- Agent-facing commands read that runtime file first and fall back to `http://127.0.0.1:4545` when no session file exists.
- All commands print concise text by default, support `--agent` for compact diagnosis-oriented output, and support `--json` where structured output is useful.

## Commands

```bash
devdeck agent setup
devdeck dev [--port PORT]
devdeck start [--port PORT] [--agent] [--wait [SECONDS]]
devdeck status [--agent|--json] [--url URL]
devdeck diagnose [--agent|--json] [--url URL]
devdeck recover [--agent|--json] [--wait [SECONDS]] [--url URL]
devdeck logs [service] [--tail 80] [--severity info|warning|error] [--grep text] [--agent|--json] [--url URL]
devdeck snapshot [--tail 120] [--agent|--json] [--url URL]
devdeck stop [--agent|--json] [--url URL]
devdeck service start <name> [--agent|--json] [--wait [SECONDS]] [--url URL]
devdeck service stop <name> [--agent|--json] [--wait [SECONDS]] [--url URL]
devdeck service restart <name> [--agent|--json] [--wait [SECONDS]] [--url URL]
```

## Typical agent flow

1. Run `devdeck agent setup` to print the agent-readable setup prompt and starter YAML.
2. Create or update `devdeck.yml` for the repository.
3. Start the local stack with `devdeck dev` or `devdeck dev --port 5000`.
4. Start bounded runtime loops with `devdeck start --agent --wait`.
5. If startup is degraded, read the inline `DIAG` packet first.
6. Use `devdeck diagnose --agent` for explicit root cause, `devdeck recover --agent --wait` for bounded targeted recovery, and `devdeck logs <service> --agent` only for focused evidence.
7. Stop the session with `devdeck stop --agent` or restart a single service with `devdeck service restart <name> --agent --wait`.

## Output modes

- Use `--agent` for compact next-action context.
- Use `--json` for full structured state.
- Use default output for human-readable summaries.

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
