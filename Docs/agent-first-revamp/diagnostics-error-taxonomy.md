# Diagnostics and Error Taxonomy

Diagnostics are the main reason DevDeck can become agent-first. Agents should not infer root causes from raw terminals when DevDeck can produce deterministic findings.

## Error code families

```txt
DD_CONFIG_*
DD_SESSION_*
DD_PROCESS_*
DD_HEALTH_*
DD_LOG_*
DD_API_*
DD_SECURITY_*
DD_INTERNAL_*
```

## Error object

```ts
type DevDeckError = {
  code: string;
  message: string;
  hint?: string;
  severity: "info" | "warning" | "error" | "fatal";
  retryable: boolean;
  service?: string;
  evidence: Evidence[];
  nextActions: NextAction[];
};
```

## Finding object

```ts
type DoctorFinding = {
  id: string;
  code: string;
  severity: "info" | "warning" | "error" | "fatal";
  service?: string;
  message: string;
  evidence: Evidence[];
  nextActions: NextAction[];
};
```

## Evidence object

```ts
type Evidence =
  | { type: "config"; path: string; field?: string; value?: unknown }
  | { type: "process"; pid?: number; command?: string; exitCode?: number | null }
  | { type: "port"; host: string; port: number; ownerPid?: number }
  | { type: "log"; service: string; eventId?: string; lines: string[] }
  | { type: "health"; service: string; check: string; result: string };
```

## Next action object

```ts
type NextAction =
  | { type: "command"; command: string; reason: string }
  | { type: "edit_file"; path: string; reason: string }
  | { type: "open_url"; url: string; reason: string }
  | { type: "manual"; description: string; reason: string };
```

## Required doctor checks

`devdeck doctor --json` must work with or without an active session and check:

- config file exists;
- YAML parses;
- schema validates;
- project root detected;
- cwd paths exist;
- dependency graph is valid;
- dependency cycle absent;
- required env values available;
- env files exist;
- declared ports available before startup;
- active session state exists or not;
- active session PID is alive;
- local API server reachable;
- session belongs to current project root;
- services are running/ready/healthy;
- recent error blocks exist;
- stale processes or occupied ports exist;
- Docker daemon reachable when Docker commands are detected;
- package manager dependencies appear installed when package scripts are detected.

## Required diagnose behavior

`devdeck diagnose <service> --json` should return:

- service config summary;
- status;
- pid;
- command;
- cwd;
- dependency status;
- readiness status;
- health status;
- last exit code;
- restart count;
- last error block;
- relevant log context;
- likely deterministic cause;
- next recommended commands.

## Example codes

```txt
DD_CONFIG_NOT_FOUND
DD_CONFIG_INVALID_YAML
DD_CONFIG_INVALID_SCHEMA
DD_CONFIG_INVALID_CWD
DD_CONFIG_DEPENDENCY_UNKNOWN
DD_CONFIG_DEPENDENCY_CYCLE
DD_CONFIG_ENV_FILE_MISSING
DD_CONFIG_ENV_MISSING
DD_SESSION_NOT_RUNNING
DD_SESSION_STALE
DD_SESSION_WRONG_PROJECT
DD_SESSION_API_UNREACHABLE
DD_PROCESS_SPAWN_FAILED
DD_PROCESS_EXITED_NON_ZERO
DD_PROCESS_PORT_CONFLICT
DD_PROCESS_TREE_STOP_FAILED
DD_HEALTH_TIMEOUT
DD_HEALTH_UNREACHABLE
DD_HEALTH_HTTP_STATUS_MISMATCH
DD_LOG_QUERY_INVALID
DD_API_ACTION_IN_PROGRESS
DD_SECURITY_SECRET_REDACTED
DD_INTERNAL_UNEXPECTED
```

## Severity rules

- `fatal`: DevDeck cannot continue safely.
- `error`: requested operation failed.
- `warning`: operation may continue but the state is degraded or risky.
- `info`: useful state, no action required.

## Retryability rules

Mark an error retryable only if repeating the same command can reasonably succeed without user/code/config changes. Examples:

- API temporarily unreachable: maybe retryable.
- Missing config: not retryable.
- Port conflict: not retryable until the port is freed.
- Health timeout: retryable only if startup is still in progress.
