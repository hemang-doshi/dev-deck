# Complex SaaS Stack Fixture

This fixture exists to create a realistic runtime-management battlefield for DevDeck benchmarks. It is intentionally heavier than the existing `node-api-worker` fixture so future benchmarks can test startup, health verification, failure diagnosis, targeted recovery, and shutdown behavior on a believable multi-service application.

The goal is not perfect infrastructure fidelity. The goal is deterministic orchestration pain that a coding agent would normally have to manage manually.

## What this fixture is testing

- multi-service startup sequencing
- health and readiness verification across app and infra-like services
- runtime failures that happen after startup, not only at process spawn
- noisy worker logs that punish raw log dumping
- cleanup discipline and port release behavior

## Services and ports

- `web` on `3000`
- `api` on `4000`
- `mock-external-api` on `4500`
- `postgres` mock on `15432`
- `redis` mock on `16379`
- `worker` has no public port; writes heartbeat to `.fixture-state/worker-heartbeat.json`
- `scheduler` has no public port; writes heartbeat to `.fixture-state/scheduler-heartbeat.json`

## Env vars

The fixture uses committed fake values in `.env.fixture` and provides the same template in `.env.example`.

Required variables:

- `DATABASE_URL`
- `REDIS_URL`
- `MOCK_EXTERNAL_API_URL`
- `SESSION_SECRET`
- `API_PORT`
- `WEB_PORT`
- `FEATURE_QUEUE_ENABLED`
- `SEED_DEMO_DATA`

## Health and readiness surface

- `web`
  - `/`
  - `/healthz`
  - `/dashboard` proxies to the API
- `api`
  - `/health/live`
  - `/health/ready`
  - `/api/dashboard`
- `mock-external-api`
  - `/health`
  - `/v1/billing-status`
- `postgres` mock
  - TCP on `15432`
  - simple text commands: `PING`, `READY`, `MIGRATE`, `DASHBOARD`
- `redis` mock
  - TCP on `16379`
  - simple text commands: `PING`, `INFO`, `ENQUEUE`, `DEQUEUE`

## Scenarios

Scenario state lives in `.fixture-state/scenario.json`. Apply one with:

```bash
npm run scenario:startup-success
npm run scenario:missing-env
npm run scenario:port-conflict
npm run scenario:api-crash-after-start
npm run scenario:noisy-worker
```

Implemented scenarios:

- `startup-success`
- `missing-env`
- `port-conflict`
- `api-crash-after-start`
- `noisy-worker`

## Manual baseline

This is the kind of raw orchestration sequence later benchmarks should compare against DevDeck:

```bash
npm run start:postgres
npm run start:redis
npm run start:mock-external-api
npm run start:api
npm run start:worker
npm run start:scheduler
npm run start:web
npm run health
```

In practice an agent would need separate shells, repeated health checks, targeted log inspection, and manual cleanup.

## Running manually without DevDeck

1. Install local fixture metadata:

```bash
npm install
```

2. Reset to a clean scenario:

```bash
npm run scenario:startup-success
```

3. Start services in separate terminals using the manual baseline sequence above.

4. Verify the stack:

```bash
npm run health
```

5. Clean up:

```bash
npm run cleanup
```

## Running with DevDeck

From this fixture root:

```bash
npx devdeck start
npx devdeck status --agent
npx devdeck stop
```

The local `devdeck.yml` intentionally uses only config fields the current repo supports. Some desired future behavior from the product-validation docs is not yet encoded here because the runtime does not implement it yet.

## Failure injection notes

- `missing-env` removes required API variables through scenario state, causing startup config failure.
- `port-conflict` daemonizes a helper server on port `4000`.
- `api-crash-after-start` allows the API to become ready, then crashes after a deterministic delay or on dashboard access.
- `noisy-worker` increases worker polling log volume and emits periodic warnings.

## Known limitations in this first slice

- Postgres and Redis are lightweight Node substitutes, not real infrastructure services.
- The mock infra uses substitute ports `15432` and `16379` instead of `5432` and `6379` to avoid clashing with real local services.
- There is no first-slice `diagnose --agent` integration yet.
- DevDeck wait semantics are limited by the current runtime implementation.
- Worker and scheduler health are validated through heartbeat files rather than service-owned HTTP probes.
- Cleanup is best-effort for known fixture pids and the port-occupier helper, not a full orphan-process reaper.

## Future benchmark use

This fixture is intended for the next product-validation slices:

- strict instruction experiments
- bounded lifecycle command work
- deterministic diagnosis work
- live-agent manual-versus-DevDeck comparisons
