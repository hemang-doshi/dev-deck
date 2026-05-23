# DevDeck — Product One-Pager

**File:** `/docs/01-product-one-pager.md`  
**Product:** DevDeck  
**Tagline:** Run your frontend, backend, workers, queues, and browser logs from one beautiful local dashboard.  
**Category:** Local-first developer productivity / devtool / log streaming cockpit  
**Stage:** Open-source MVP

---

## 1. One-Line Summary

**DevDeck is a local-first dev cockpit that lets developers run, monitor, and visually debug multiple local services from one beautiful dashboard instead of juggling scattered terminal tabs.**

---

## 2. The Problem

Modern full-stack development is no longer just one frontend and one backend.

A realistic local development setup may include:

- a frontend dev server
- a backend API server
- one or more background workers
- queue consumers
- cron jobs
- Docker services
- database containers
- local AI/LLM services
- ingestion pipelines
- webhook listeners
- eventually, browser console/runtime logs

Today, developers usually manage these across several terminals, browser windows, DevTools panels, Docker logs, and scattered command outputs.

This creates a messy debugging experience:

- important errors are easy to miss
- logs are visually noisy and inconsistent
- related events across services are hard to correlate
- switching between terminal tabs breaks flow
- background workers and queue consumers are especially easy to forget
- copy-pasting debugging context into AI tools is manual and incomplete
- onboarding into multi-service repos is slower than it should be

The pain is not that logs do not exist. The pain is that **dev-time signal is fragmented across too many places**.

---

## 3. Core Insight

Most logging and observability tools are built for production systems, teams, metrics, retention, alerts, dashboards, compliance, and infrastructure-level monitoring.

DevDeck is intentionally not trying to compete there.

The core insight is:

> Local development needs a lightweight command center, not a production observability platform.

Developers do not always need long-term storage, indexing, query languages, or enterprise dashboards while building locally.

They need:

- one command to start the local system
- one screen to see every service
- immediate visibility into errors and warnings
- clean separation between frontend, backend, workers, and infrastructure logs
- fast search and filtering for the current session
- easy copying of relevant debug context

---

## 4. Product Vision

DevDeck should become the default local dashboard developers open when working on multi-service projects.

Instead of starting five terminals manually, a developer should be able to run:

```bash
npx devdeck dev
```

DevDeck then:

1. reads a project config
2. starts the defined local services
3. streams logs from each service
4. shows health/status indicators
5. highlights errors, warnings, URLs, ports, and crashes
6. gives the developer a clean dashboard for the current development session

Long-term, DevDeck can expand into browser console capture, Docker log adapters, file tailing, OpenTelemetry-compatible local streams, and optional session export.

But the product must stay rooted in one promise:

> Make local multi-service debugging feel calm, visual, and fast.

---

## 5. Target Users

### Primary Users

#### 1. Full-stack developers

Developers working with separate frontend and backend processes.

Examples:

- Next.js + Express
- Vite + FastAPI
- React + Django
- Remix + NestJS
- SvelteKit + Go API

Their pain: switching between frontend logs, backend logs, browser, and API errors.

#### 2. AI app builders

Developers building AI products with multiple moving pieces.

Examples:

- frontend app
- API server
- embedding worker
- ingestion pipeline
- vector database
- queue consumer
- local LLM or model gateway

Their pain: AI systems often fail in background jobs, ingestion steps, and async workers, where terminal visibility is weak.

#### 3. Hackathon builders and student teams

Small teams shipping fast with messy but functional local setups.

Their pain: projects become hard to run and debug when multiple teammates have different terminal commands and unclear service dependencies.

#### 4. Indie hackers and solo builders

Developers working alone on production-like local stacks.

Their pain: they want speed, clarity, and less context switching without configuring heavy observability tools.

---

## 6. Non-Target Users For MVP

DevDeck is not initially for:

- enterprise production observability teams
- SRE teams managing deployed infrastructure
- security/compliance-heavy log retention use cases
- teams needing permanent centralized log storage
- cloud-native alerting and incident response workflows
- business analytics based on logs

These users may benefit from DevDeck later, but they are not the MVP audience.

---

## 7. Positioning

### Bad Positioning

DevDeck should not be positioned as:

- a Grafana alternative
- a Loki alternative
- a production logging platform
- an analytics tool
- a generic log storage product
- a DevOps monitoring suite

That positioning is too broad and puts DevDeck against mature tools with deeper infrastructure capabilities.

### Strong Positioning

DevDeck should be positioned as:

> A local-first dev cockpit for running and debugging multi-service apps.

Or:

> A beautiful local dashboard for developers tired of debugging across five terminal tabs.

Or:

> One command to run your stack. One screen to see what broke.

---

## 8. Core Use Case

A developer opens a project with multiple local services.

Instead of manually starting each command, they define a `devdeck.yml` file:

```yaml
project: my-app

services:
  web:
    command: npm run dev
    cwd: ./frontend
    port: 3000

  api:
    command: npm run dev
    cwd: ./backend
    port: 8000

  worker:
    command: python worker.py
    cwd: ./worker
```

Then they run:

```bash
npx devdeck dev
```

DevDeck opens a local dashboard at:

```txt
http://localhost:4545
```

The dashboard shows:

- all running services
- live logs per service
- a unified cross-service stream
- error and warning highlights
- service health and port status
- searchable current-session logs
- a button to copy relevant debug context

---

## 9. MVP Product Principles

### 1. Local-first

DevDeck should run locally by default. No accounts, no cloud dependency, no remote log shipping.

### 2. Zero-storage by default

The MVP should not persist logs to disk or a database unless the user explicitly exports the current session.

Logs should live in an in-memory ring buffer.

### 3. Process-first, not port-first

Services are defined by the commands that produce logs. Ports are optional metadata used for health checks and clickable links.

This matters because many important services do not expose ports:

- workers
- queue consumers
- cron jobs
- scripts
- ingestion jobs

### 4. Visual clarity over observability complexity

DevDeck should make the current development session easier to understand. It should not try to recreate production observability dashboards in the MVP.

### 5. Fast setup

The first useful experience should take under 2 minutes.

A user should be able to install, define services, run the command, and see logs quickly.

### 6. Framework-agnostic but modern-stack friendly

DevDeck should not be tied to one framework, but the initial defaults should feel excellent for modern web stacks like Next.js, Vite, Express, FastAPI, NestJS, Django, and worker-based AI apps.

---

## 10. MVP Feature Set

The MVP should include:

- CLI command: `devdeck init`
- CLI command: `devdeck dev`
- `devdeck.yml` project config
- multi-process command runner
- stdout/stderr log streaming
- local WebSocket server
- browser dashboard
- service sidebar
- unified log stream
- per-service log view
- log level detection
- error/warning highlighting
- basic search
- filters by service and severity
- service start/stop/restart actions
- port health checks
- clickable local service URLs
- clear current logs
- copy selected logs
- copy debug context
- export current session as `.txt` or `.ndjson`

---

## 11. Explicit MVP Non-Goals

The MVP should not include:

- cloud sync
- user accounts
- team workspaces
- production agents
- long-term log storage
- hosted dashboards
- alerting
- Slack/Discord notifications
- custom query language
- metrics dashboards
- tracing
- deep OpenTelemetry ingestion
- browser console capture through Chrome DevTools Protocol
- browser extension
- Kubernetes support
- permissions/RBAC
- billing

These may be future features, but including them in the MVP would dilute the product and slow down shipping.

---

## 12. Future Scope

### Browser Console Capture

Browser console capture is a major future opportunity because frontend runtime errors are still separated from backend and worker logs.

Future implementation options:

1. Chrome DevTools Protocol integration
2. injected browser client script
3. browser extension
4. Vite/Next.js plugin

This should not be part of the first MVP because it introduces complexity around browser launching, runtime sessions, source maps, security, and cross-browser behavior.

But long-term, this could become one of DevDeck's strongest differentiators:

> See backend logs, worker logs, and browser console errors in one timeline.

### Docker Support

Future support for:

- `docker compose logs`
- container status
- restart container actions
- service grouping between local commands and containers

### AI Debug Assistant

A future optional layer could summarize crash context or prepare prompts for AI coding agents.

The MVP should start with deterministic context copying, not AI magic.

Example future feature:

```txt
Copy AI Debug Bundle
```

This bundle could include:

- recent logs around the error
- service name
- command
- exit code
- relevant stack trace
- recent related logs from other services
- project config summary

---

## 13. Competitive Landscape

DevDeck overlaps with several categories but should avoid becoming a shallow clone of any one of them.

### Terminal multiplexers

Examples:

- tmux
- iTerm panes
- VS Code terminals

They help organize terminals but do not provide semantic log understanding, service status, health checks, or a polished dashboard.

### Multi-command runners

Examples:

- concurrently
- npm-run-all
- turbo dev
- pnpm recursive scripts

They run multiple commands but usually output logs into one noisy stream or separate terminal panes.

### Local log viewers

Examples:

- Logdy
- lnav

They improve log viewing, but DevDeck's wedge should be full local dev orchestration: starting services, grouping them, checking health, and providing a dashboard designed for modern multi-service app development.

### Production observability tools

Examples:

- Grafana Loki
- Datadog
- New Relic
- Elastic Stack

These are powerful but too heavy for the local-first dev loop DevDeck is targeting.

---

## 14. Differentiation

DevDeck's differentiation should come from the combination of:

1. **Process orchestration** — start and manage local services
2. **Live log streaming** — real-time logs in the browser
3. **Visual grouping** — clear service lanes and filters
4. **Local-first simplicity** — no cloud or accounts
5. **Current-session focus** — no heavy persistence layer
6. **Debug context workflows** — easy copy/export for AI-assisted debugging
7. **Future browser runtime integration** — eventually unify frontend runtime logs with backend/worker logs

The product should not win because it has the most logging features.

It should win because it makes the daily local dev loop feel dramatically better.

---

## 15. Success Metrics

### MVP Usage Metrics

- user can configure a project in under 2 minutes
- user can start 3+ services with one command
- dashboard opens automatically and streams logs reliably
- user can identify an error faster than using separate terminals
- user uses DevDeck repeatedly across multiple dev sessions

### Open Source Metrics

- GitHub stars
- demo GIF engagement
- issues opened by real users
- external contributors
- mentions on dev communities
- number of example configs added by users

### Product Quality Metrics

- process startup reliability
- clean shutdown reliability
- log stream latency
- dashboard performance with high log volume
- crash handling quality
- cross-platform behavior on macOS/Linux/Windows

---

## 16. Key Risks

### Risk 1: Existing tools already solve enough of the problem

Mitigation:

Do not position DevDeck as a generic log viewer. Position it as a local dev cockpit that combines process running, health, and visual debugging.

### Risk 2: Scope creep into observability platform

Mitigation:

Keep MVP local-first, zero-storage, and current-session focused.

### Risk 3: Process management becomes painful across platforms

Mitigation:

Start with macOS/Linux-friendly behavior, document Windows limitations if needed, and improve process tree handling over time.

### Risk 4: UI becomes pretty but not faster

Mitigation:

Every visual feature should help answer one of these questions:

- What is running?
- What broke?
- Where did it break?
- What happened right before it broke?
- What should I copy to debug it?

### Risk 5: Browser console capture adds too much complexity too early

Mitigation:

Keep browser console capture as explicit future scope.

---

## 17. North Star Experience

A developer clones a full-stack app and sees this in the README:

```bash
npx devdeck dev
```

They run it.

DevDeck starts the frontend, backend, worker, and queue consumer.

The dashboard opens automatically.

A backend error occurs.

The API lane flashes red.

The unified stream shows the frontend request, backend 500, and worker activity around the same time.

The developer clicks:

```txt
Copy Debug Context
```

They paste the context into an AI coding agent or issue report and fix the bug faster.

That is the product.

---

## 18. Final Product Statement

DevDeck is not a logging platform.

DevDeck is a local development cockpit.

It exists for the moment when a developer has too many moving pieces running locally and needs one calm, beautiful, high-signal place to see what is happening.

The MVP should obsess over one thing:

> Replace scattered terminal chaos with a focused local dashboard developers actually want to keep open.

