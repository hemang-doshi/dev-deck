# Event and Log Model

DevDeck should treat logs and runtime changes as structured events first, then render them for humans.

## Goals

- Make logs queryable by service, severity, time, and error block.
- Make event streams consumable by agents.
- Keep output bounded by default.
- Persist enough context for debugging after a failure.
- Redact secrets before display/export.

## Event envelope

```ts
type DevDeckEvent = {
  schemaVersion: "devdeck.event.v1";
  id: string;
  sessionId: string;
  project: string;
  timestamp: string;
  observedTimestamp: string;
  type:
    | "session.started"
    | "session.stopping"
    | "session.stopped"
    | "service.pending"
    | "service.spawned"
    | "service.running"
    | "service.ready"
    | "service.health_changed"
    | "service.log"
    | "service.exited"
    | "service.failed"
    | "doctor.finding"
    | "action.started"
    | "action.completed"
    | "action.failed";
  service?: string;
  stream?: "stdout" | "stderr" | "system";
  severityText?: "TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR" | "FATAL";
  severityNumber?: number;
  body?: string;
  attributes?: Record<string, unknown>;
};
```

## JSONL stream

`devdeck events --stream --jsonl` and `devdeck logs --stream --jsonl` output one JSON event per line. No banners, spinners, ANSI styling, or progress text may appear in JSONL mode.

Example:

```jsonl
{"schemaVersion":"devdeck.event.v1","id":"evt_001","type":"service.spawned","service":"api","timestamp":"2026-06-08T00:00:00.000Z","attributes":{"pid":12345}}
{"schemaVersion":"devdeck.event.v1","id":"evt_002","type":"service.log","service":"api","stream":"stdout","severityText":"INFO","body":"server listening on 4000"}
```

## Log classification

DevDeck may classify severity using deterministic rules:

- stderr defaults to `ERROR` unless known noisy pattern is configured;
- lines containing `error`, `exception`, `failed`, `EADDRINUSE`, or stack traces should become candidate error events;
- URL and port extraction should be captured as attributes;
- multi-line stack traces should be grouped into error blocks.

## Error blocks

An error block is a compact diagnostic unit:

```ts
type ErrorBlock = {
  id: string;
  service: string;
  firstEventId: string;
  lastEventId: string;
  startedAt: string;
  endedAt?: string;
  severity: "warning" | "error" | "fatal";
  title: string;
  lines: string[];
  probableCodes: string[];
};
```

Agents should prefer `--errors --context` over raw log tails.

## Query behavior

Required filters:

- service;
- stream;
- severity;
- tail;
- since event ID;
- since timestamp;
- grep;
- errors only;
- context lines around error.

Examples:

```bash
devdeck logs api --errors --context 20 --json
devdeck logs --severity error --tail 50 --json
devdeck events --since evt_123 --jsonl
```

## Persistence

- Keep a bounded in-memory buffer for dashboard responsiveness.
- Persist session events to JSONL.
- Persist raw stdout/stderr per service.
- Persist final summary on session shutdown.
- Redact configured secrets before export.

## Export format

`devdeck export --json` should include:

- config summary, not full secrets;
- service states;
- latest health checks;
- error blocks;
- bounded logs;
- environment diagnostics;
- action history;
- version info.
