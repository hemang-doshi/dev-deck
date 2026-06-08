# CLI v2 Specification

The CLI is the primary interface for coding agents. Human-readable output is allowed by default, but every agent-facing command must support a stable `--json` form.

## Principles

- Human text is for people. JSON is the contract.
- Streaming output must use JSONL.
- Commands must be bounded by default.
- Exit codes must be deterministic.
- Command modules must not call `process.exit` directly; they should return typed results/errors to the CLI boundary.
- Errors must include codes, hints, evidence, and next actions where possible.

## Response envelope

Every `--json` command returns this shape:

```json
{
  "schemaVersion": "devdeck.response.v1",
  "ok": true,
  "command": "session.status",
  "requestId": "req_01H...",
  "project": "my-app",
  "sessionId": "sess_01H...",
  "timestamp": "2026-06-08T00:00:00.000Z",
  "summary": "3 services running, 2 ready, 1 degraded.",
  "result": {},
  "error": null,
  "nextActions": []
}
```

For failure:

```json
{
  "schemaVersion": "devdeck.response.v1",
  "ok": false,
  "command": "doctor",
  "requestId": "req_01H...",
  "project": "my-app",
  "sessionId": "sess_01H...",
  "timestamp": "2026-06-08T00:00:00.000Z",
  "summary": "api cannot start because DATABASE_URL is missing.",
  "result": null,
  "error": {
    "code": "DD_CONFIG_ENV_MISSING",
    "message": "Required environment variable DATABASE_URL is missing.",
    "severity": "error",
    "retryable": false,
    "service": "api",
    "hint": "Create .env or export DATABASE_URL before restarting api.",
    "evidence": [],
    "nextActions": []
  },
  "nextActions": []
}
```

## Required commands

### Session lifecycle

```bash
devdeck start [--json] [--wait 60] [--detach] [--port 4545]
devdeck stop [--json] [--force]
devdeck restart [--json] [--wait 60]
devdeck status [--json]
devdeck snapshot [--json] [--mode human|agent] [--tail 120]
devdeck doctor [--json]
```

### Service lifecycle

```bash
devdeck service status <name> [--json]
devdeck service start <name> [--json] [--wait 60]
devdeck service stop <name> [--json] [--force]
devdeck service restart <name> [--json] [--wait 60]
devdeck service logs <name> [--json] [--tail 100] [--errors] [--context 20]
```

### Config commands

```bash
devdeck init
devdeck init --detect
devdeck config validate [--json]
devdeck config explain [--json]
devdeck config suggest [--json]
```

### Session repair commands

```bash
devdeck session inspect [--json]
devdeck session clear-stale [--json]
devdeck session kill-orphans [--json]
```

### Streaming commands

```bash
devdeck logs --stream --jsonl
devdeck events --stream --jsonl
devdeck events --since <eventId> --jsonl
```

## Exit codes

- `0`: success.
- `1`: handled DevDeck error.
- `2`: invalid CLI usage.
- `3`: config validation failed.
- `4`: session unavailable or stale.
- `5`: service failed or unhealthy.
- `10`: unexpected internal error.

The JSON envelope remains the source of truth. Exit codes are only coarse shell signals.

## Snapshot modes

### `--mode human`

Optimized for terminal reading. May include formatting, grouping, and hints.

### `--mode agent`

Optimized for token-efficient machine consumption:

- no decorative formatting;
- bounded logs;
- explicit service states;
- latest error block per failed/degraded service;
- links and ports;
- next recommended commands.

## Compatibility

Existing commands should remain available where possible. If command behavior changes, add deprecation warnings in human output but keep JSON output clean.
