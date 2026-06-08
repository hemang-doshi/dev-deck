# Config v2 Specification

`devdeck.yml` must become a versioned runtime contract, not just a list of commands.

## Minimum valid config

```yaml
version: 2
project: my-app
services:
  web:
    command: npm run dev
    cwd: .
```

## Full example

```yaml
version: 2

project: scenebook

defaults:
  shell: true
  startupTimeoutMs: 60000
  shutdownTimeoutMs: 10000
  restartPolicy:
    mode: never
  log:
    maxLines: 2000
    persist: true
    redact:
      - DATABASE_URL
      - OPENAI_API_KEY
      - HF_TOKEN

services:
  db:
    command: docker compose up db
    cwd: .
    group: infra
    health:
      type: tcp
      host: 127.0.0.1
      port: 5432
      timeoutMs: 45000
    stop:
      command: docker compose stop db
      timeoutMs: 15000

  api:
    command: npm run dev
    cwd: ./apps/api
    group: backend
    dependsOn:
      db:
        condition: healthy
    envFiles:
      - .env
    requiredEnv:
      - DATABASE_URL
    health:
      type: http
      url: http://127.0.0.1:4000/health
      expectedStatus: 200
      timeoutMs: 60000
    readiness:
      type: log
      pattern: server listening
    links:
      - label: API
        url: http://127.0.0.1:4000

  web:
    command: npm run dev
    cwd: ./apps/web
    group: frontend
    dependsOn:
      api:
        condition: ready
    health:
      type: http
      url: http://127.0.0.1:3000
    links:
      - label: App
        url: http://127.0.0.1:3000
```

## Top-level fields

### `version`

Required for v2. Current unversioned configs are treated as v1 and normalized.

### `project`

Human and machine-readable project identifier. Required.

### `defaults`

Optional defaults applied to services unless overridden.

### `services`

Required map of service IDs to service definitions.

## Service fields

### `command`

Convenience string command. Runs through a shell if `shell: true`.

### `exec.argv`

Preferred structured execution form for future reliability:

```yaml
exec:
  argv: ["npm", "run", "dev"]
```

A service may use `command` or `exec`, but not both.

### `cwd`

Working directory relative to the config file. Required.

### `group`

Optional grouping label for dashboard and snapshots.

### `dependsOn`

Dependency conditions. Must not mean spawn order only.

Allowed conditions:

- `started`
- `ready`
- `healthy`
- `completed_successfully`

### `health`

Determines whether a running service remains usable.

Supported v2 health types:

```yaml
health:
  type: tcp
  host: 127.0.0.1
  port: 5432
```

```yaml
health:
  type: http
  url: http://127.0.0.1:3000/health
  expectedStatus: 200
```

```yaml
health:
  type: command
  command: npm run healthcheck
  timeoutMs: 10000
```

### `readiness`

Determines when a service is ready for dependents.

Supported v2 readiness types:

```yaml
readiness:
  type: log
  pattern: ready
```

```yaml
readiness:
  type: http
  url: http://127.0.0.1:3000
  expectedStatus: 200
```

```yaml
readiness:
  type: tcp
  port: 3000
```

### `restartPolicy`

Default should be `never` to preserve failure causality for agents.

```yaml
restartPolicy:
  mode: on-failure
  maxRestarts: 3
  delayMs: 1000
```

### `stop`

Optional graceful stop command and timeout.

```yaml
stop:
  command: docker compose stop db
  timeoutMs: 15000
```

If absent, DevDeck should stop the process tree itself.

### `envFiles` and `requiredEnv`

`envFiles` loads environment files. `requiredEnv` is validated before startup and by doctor.

### `links`

Dashboard and agent-discoverable URLs.

## Normalization rules

- v1 configs without `version` normalize to v2 internally.
- v1 `port` maps to both a TCP health check and a link candidate when reasonable.
- Missing `cwd` remains invalid unless compatibility mode can infer `.` safely.
- String commands remain supported.

## Validation rules

The config validator must detect:

- missing config;
- invalid YAML;
- missing project;
- missing services;
- duplicate service IDs by normalized key;
- invalid cwd;
- command/exec conflicts;
- dependency cycles;
- unknown dependency targets;
- invalid ports and URLs;
- unsupported health/readiness types;
- missing required env;
- invalid timeout values.
