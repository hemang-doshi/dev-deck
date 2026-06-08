# Product Requirements: Agent-First DevDeck

## Problem

AI coding agents repeatedly waste tokens and time doing low-level runtime work: starting frontend/backend services, watching terminals, checking ports, reading unbounded logs, killing orphaned processes, and retrying stale commands. Humans face the same chaos, but agents suffer more because terminal output is noisy, ambiguous, and expensive to reason over.

DevDeck must become the local runtime control plane that agents can depend on instead of manually managing processes.

## Users

### Primary user: AI coding agent

Needs:

- deterministic service lifecycle commands;
- bounded state snapshots;
- structured errors with hints and next actions;
- queryable logs;
- safe restart/stop operations;
- zero guessing about readiness, health, stale sessions, or process ownership.

### Secondary user: human developer

Needs:

- one command to bring up a local stack;
- dashboard visibility;
- clear error messages;
- reliable shutdown;
- quick copy/export of debugging context.

### Tertiary user: OSS contributor

Needs:

- understandable architecture;
- documented contracts;
- stable tests and fixtures;
- non-surprising defaults;
- clear project scope.

## Goals

1. Provide a stable CLI and local API contract for agent-controlled runtime management.
2. Distinguish process spawn, readiness, health, degraded state, failure, and clean shutdown.
3. Make diagnostics deterministic and machine-readable.
4. Make logs and events structured, streamable, bounded, and queryable.
5. Preserve simple onboarding for basic projects.
6. Support production-grade OSS expectations: docs, versioning, test fixtures, safety, and release discipline.

## Non-goals

- DevDeck is not a cloud deployment platform.
- DevDeck is not a team collaboration SaaS.
- DevDeck is not a Kubernetes replacement.
- DevDeck is not a generic shell automation framework.
- DevDeck should not require an LLM to run or diagnose itself.
- DevDeck should not prioritize dashboard visuals before runtime correctness.

## Product positioning

DevDeck should be described as:

> An agent-native local runtime supervisor and black-box recorder for AI-assisted software development.

Avoid positioning it as only:

- a process manager;
- a prettier terminal multiplexer;
- a dashboard;
- a simple `npm run dev` wrapper.

## MVP success criteria

DevDeck v2 is successful when an agent can perform this flow without manual terminal scraping:

```bash
devdeck status --json
devdeck start --json --wait 60
devdeck snapshot --json --mode agent
devdeck logs api --errors --context 20 --json
devdeck doctor --json
devdeck service restart api --json --wait 60
devdeck stop --json
```

The outputs must be bounded, structured, and stable enough for automated consumption.

## Acceptance scenarios

### Scenario 1: Basic stack startup

Given a project with `web`, `api`, and `worker`, when the agent runs `devdeck start --json --wait 60`, then DevDeck starts all services, reports state per service, exposes dashboard links, and exits with a deterministic success/failure code.

### Scenario 2: Dependency readiness

Given `web` depends on `api.ready`, and `api` depends on `db.healthy`, DevDeck must not start or mark dependents ready until the dependency condition is satisfied.

### Scenario 3: Missing environment

Given `api.requiredEnv` contains `DATABASE_URL`, and the variable is missing, `devdeck doctor --json` must produce a blocking finding with a specific error code, evidence, and next action.

### Scenario 4: Port conflict

Given port `3000` is occupied before startup, DevDeck must identify the conflict before or during startup, return a typed error, and avoid silently starting an unusable session.

### Scenario 5: Stale session

Given `.devdeck/state.json` points to a dead process, `devdeck status --json` must report `stale`, and `devdeck session clear-stale --json` must repair state without requiring manual file deletion.

### Scenario 6: Process tree shutdown

Given a service spawns child processes, `devdeck stop --json` must stop the whole process tree and verify declared ports are released.

### Scenario 7: Agent benchmark

Given a fixture repo with a seeded runtime bug, an agent using DevDeck should identify the root cause faster and with fewer repeated commands than an agent using raw shell process management.

## Release gate

Do not label this revamp production-grade until:

- config v2 is documented and tested;
- all JSON response envelopes are stable;
- process-tree shutdown is tested;
- diagnostics cover at least config missing, invalid cwd, missing env, port conflict, stale session, server unreachable, health timeout, and non-zero exit;
- fixture apps exist for automated agent/runtime tests;
- docs explain package identity, install method, and migration from current config.
