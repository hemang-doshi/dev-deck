# Complex Stack Fixture

## Proposed fixture path

```txt
benchmarks/fixtures/complex-saas-stack/
```

## Purpose

This fixture exists to test whether DevDeck helps a real agent manage runtime coordination in a realistic local application, not whether DevDeck can print compact output for a toy project.

The fixture should be opinionated, noisy enough to create real orchestration pain, and deterministic enough to benchmark repeatedly.

## Target shape

The fixture should model a small but believable SaaS codebase with multiple moving parts:

- `apps/web` for the frontend
- `apps/api` for the main HTTP API
- `apps/worker` for asynchronous job processing
- `apps/scheduler` for cron-like recurring jobs
- `infra/postgres` or containerized Postgres
- `infra/redis` or containerized Redis
- `services/mock-external-api` for third-party dependency simulation
- optional `services/mock-mail` for notification or webhook capture

## Required services

### Web frontend

- role: browser-facing app for login, dashboard, and user actions
- likely stack: Next.js, Vite, or similar local frontend dev server
- depends on: API
- readiness: HTTP 200 on `/` and startup port open
- health: HTTP 200 on `/healthz` or root page
- logs: request failures, build errors, proxy failures

### API server

- role: main app backend
- depends on: Postgres, Redis, mock external API
- readiness: HTTP 200 on `/health/ready`
- health: HTTP 200 on `/health/live`
- logs: startup config errors, migration errors, downstream failures

### Background worker

- role: queue processor for async jobs
- depends on: API contract, Postgres, Redis
- readiness: log pattern `worker ready`
- health: command or heartbeat file, or Redis heartbeat key
- logs: noisy job polling plus structured errors

### Scheduler

- role: recurring jobs that enqueue work or sync data
- depends on: API or DB, Redis
- readiness: log pattern `scheduler started`
- health: heartbeat file or HTTP endpoint
- logs: recurring ticks, occasional warnings

### Postgres or database service

- role: primary relational data store
- readiness: TCP on `5432` and successful probe query
- health: `pg_isready`
- logs: startup readiness, connection failures, migration events

### Redis or queue/cache service

- role: job queue broker and cache
- readiness: TCP on `6379`
- health: `PING`
- logs: connection events, persistence warnings

### Mock external API

- role: deterministic replacement for a third-party billing, CRM, or enrichment API
- readiness: HTTP 200 on `/health`
- health: HTTP 200 on `/health`
- logs: upstream simulation errors, auth failures, rate-limit simulation

### Optional mail or mock notification service

- role: local capture of outbound emails or webhooks
- readiness: HTTP 200 on `/health`
- health: HTTP 200 on `/health`
- logs: message receipt, webhook delivery

## Proposed dependency graph

```txt
postgres -> api
redis -> api
mock-external-api -> api
api -> web
postgres -> worker
redis -> worker
api -> worker
redis -> scheduler
api -> scheduler
optional mock-mail <- api and worker
```

The graph matters because startup, readiness waits, diagnosis, and targeted restarts should respect the actual runtime relationships.

## Proposed ports

- web: `3000`
- api: `4000`
- worker: no public port by default; optional metrics port `4100`
- scheduler: no public port by default; optional metrics port `4200`
- postgres: `5432`
- redis: `6379`
- mock-external-api: `4500`
- mock-mail: `8025`

## Required environment variables

The fixture should require enough env to create realistic failures without becoming secret-heavy:

- `DATABASE_URL`
- `REDIS_URL`
- `API_PORT`
- `WEB_PORT`
- `MOCK_EXTERNAL_API_URL`
- `SESSION_SECRET`
- `FEATURE_QUEUE_ENABLED`
- `SEED_DEMO_DATA`
- optional `MAILER_BASE_URL`

A `.env.example` should exist later, but the benchmark fixture must also support missing-env injection.

## Readiness checks

- web: HTTP check on `http://127.0.0.1:3000/`
- api: HTTP check on `http://127.0.0.1:4000/health/ready`
- worker: log readiness pattern plus Redis connectivity confirmation
- scheduler: log readiness pattern
- postgres: TCP plus `pg_isready`
- redis: TCP plus `PING`
- mock external API: HTTP `GET /health`
- mock mail: HTTP `GET /health`

## Health checks

Readiness is not enough. Ongoing health should degrade later when dependencies break.

- web: successful API proxy call for a small health route
- api: live route plus DB and Redis dependency status
- worker: heartbeat updated within recent interval and queue access successful
- scheduler: last successful tick within recent interval
- postgres: connection probe
- redis: ping probe
- mock external API: health route and deterministic failure mode flag
- mock mail: health route

## Log design

The fixture should intentionally produce realistic log patterns:

- startup banners and normal ready lines
- intermittent informational worker polling lines
- periodic scheduler tick lines
- compact but identifiable error blocks
- enough noise to punish raw log dumping

The worker should be noisy enough that manual diagnosis is expensive but not so noisy that the benchmark becomes random.

## Startup order

1. postgres
2. redis
3. mock external API
4. optional mock mail
5. api
6. worker
7. scheduler
8. web

This order should be enforced by readiness and health conditions, not just spawn order.

## Failure injection modes

The fixture must support deterministic toggles for the following failure modes:

- missing env
- port conflict
- API crash after startup
- DB not ready
- Redis unavailable
- noisy worker logs
- stuck queue job
- frontend/API mismatch causing 500
- migration failure
- stale session
- orphan process

## Failure mode details

### Missing env

- remove `DATABASE_URL` or `SESSION_SECRET`
- expected symptom: API cannot start or crashes immediately
- expected diagnosis value: deterministic config finding before raw startup retries

### Port conflict

- occupy `3000` or `4000` before startup
- expected symptom: web or API fails to bind
- expected diagnosis value: typed port-conflict finding with owner evidence

### API crash after startup

- API starts, serves health briefly, then exits on first external API call
- expected symptom: web may load but action routes fail later
- expected diagnosis value: DevDeck should surface last good state plus crash evidence

### DB not ready

- hold Postgres readiness for a fixed delay or broken probe
- expected symptom: API remains waiting or times out
- expected diagnosis value: dependency wait reasoning instead of raw retry loops

### Redis unavailable

- fail Redis startup or block connectivity
- expected symptom: worker and scheduler degrade, API may partially work
- expected diagnosis value: targeted service or dependency attribution

### Noisy worker logs

- emit frequent benign polling lines
- expected symptom: manual `tail` output becomes expensive
- expected diagnosis value: bounded diagnosis should avoid dumping noise first

### Stuck queue job

- enqueue a job that never acknowledges completion
- expected symptom: worker appears alive but degraded
- expected diagnosis value: identify blocked queue behavior, not just service running state

### Frontend/API mismatch causing 500

- web sends a request shape that current API rejects
- expected symptom: user-visible failure while all processes are technically running
- expected diagnosis value: force agent to keep the stack running while locating the mismatch

### Migration failure

- API startup runs a failing migration step
- expected symptom: startup loop or non-zero exit before ready
- expected diagnosis value: compact migration error instead of raw full logs

### Stale session

- leave DevDeck session metadata after force-killing the supervisor or services
- expected symptom: status confusion unless stale-session repair exists
- expected diagnosis value: distinguish stale metadata from running processes

### Orphan process

- child process survives parent shutdown or occupies a declared port
- expected symptom: restart or stop path appears successful but the port remains in use
- expected diagnosis value: stop verification and orphan detection

## Expected manual orchestration pain

The fixture should force the manual baseline to deal with:

- multiple startup surfaces across app and infra
- mixed readiness semantics
- services that are running but not healthy
- noisy logs that inflate transcript size
- partial failures after startup
- downstream failures that require dependency reasoning
- cleanup risk from stale or orphaned processes

## Expected DevDeck advantage

DevDeck should have a real chance to win only if it can do these better than manual shell orchestration:

- centralize startup and dependency waiting
- expose concise stack state and degradation reasons
- provide deterministic diagnosis before raw logs
- support targeted service restart with wait semantics
- verify shutdown and detect orphaned processes

If the fixture does not create that coordination pain, it is too weak to validate the product claim.
