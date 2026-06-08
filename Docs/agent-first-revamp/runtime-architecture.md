# Runtime Architecture

DevDeck v2 should be split into layers with clear ownership. The dashboard, CLI, and future agent adapters must all talk to the same runtime model.

## Architecture layers

### 1. Config package

Responsible for:

- finding `devdeck.yml`;
- parsing YAML;
- validating schema;
- normalizing v1/v2 configs;
- resolving project root and service cwd;
- detecting dependency cycles;
- producing config diagnostics.

This package must not start processes.

### 2. Supervisor core

Responsible for:

- process spawning;
- process group tracking;
- stdout/stderr capture;
- lifecycle state machine;
- dependency scheduling;
- readiness probes;
- health probes;
- restart policy;
- graceful shutdown;
- process-tree kill fallback;
- event emission.

This is the core product. It must be deterministic and heavily tested.

### 3. Event store

Responsible for:

- append-only session events;
- structured service logs;
- error blocks;
- health history;
- bounded in-memory buffers;
- persistent JSONL files;
- redaction;
- exportable debug context.

Recommended layout:

```txt
.devdeck/
  state.json
  runs/
    sess_20260608_abc123/
      session.json
      events.jsonl
      services/
        api.stdout.log
        api.stderr.log
        api.events.jsonl
      summary.json
```

### 4. Local API server

Responsible for:

- session metadata;
- snapshots;
- logs;
- actions;
- diagnostics;
- event streaming;
- dashboard assets.

Recommended v2 routes:

```txt
GET  /api/v1/session
GET  /api/v1/snapshot
GET  /api/v1/services
GET  /api/v1/services/:id/logs
GET  /api/v1/events
GET  /api/v1/doctor
POST /api/v1/actions
WS   /api/v1/stream
```

### 5. CLI

Responsible for:

- parsing commands;
- rendering human output;
- rendering JSON envelopes;
- translating typed runtime errors to exit codes;
- never leaking unbounded logs by default.

### 6. Dashboard

Responsible for:

- visual inspection;
- live log viewing;
- service controls;
- doctor findings;
- copy/export context;
- human override.

The dashboard must consume the local API and event stream. It must not duplicate state logic.

### 7. Agent adapters

Future adapters should call the same internal services:

- CLI adapter;
- MCP adapter;
- Codex/AGENTS instructions;
- Claude/skill instructions;
- GitHub Action adapter later.

## Service state machine

Canonical states:

```ts
type ServiceStatus =
  | "disabled"
  | "pending"
  | "starting"
  | "running"
  | "ready"
  | "degraded"
  | "stopping"
  | "stopped"
  | "exited"
  | "failed"
  | "unknown";
```

Important distinctions:

- `running` means process exists.
- `ready` means dependents may proceed.
- `healthy` is an ongoing probe result, not the same thing as process state.
- `exited` means the process ended; it may or may not be failure.
- `failed` means DevDeck has classified the exit/probe/startup as a failure.
- `stopped` means DevDeck intentionally stopped it.

## Session model

A session has:

- `sessionId`;
- `project`;
- `projectRoot`;
- `configPath`;
- `startedAt`;
- `daemonPid`;
- `apiUrl`;
- `dashboardUrl`;
- service map;
- event cursor;
- run directory.

## Shutdown contract

Default shutdown sequence:

1. mark session stopping;
2. run service-specific stop commands where configured;
3. send SIGTERM to process group;
4. wait `shutdownTimeoutMs`;
5. send SIGKILL to remaining process tree;
6. verify declared ports are released;
7. write final summary;
8. clear active session state.

## Concurrency rules

- Only one active session per project root by default.
- Actions must be serialized per service.
- Start/stop/restart actions must emit action events.
- CLI commands must handle in-progress actions explicitly instead of racing them.

## Runtime invariants

- A service cannot be `ready` before it is `running`.
- A dependent cannot start before required dependency condition is satisfied.
- A stale session cannot be treated as running.
- `stop` must be safe to call multiple times.
- `doctor` must work whether a session is running or not.
