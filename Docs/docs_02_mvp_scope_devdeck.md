# DevDeck — MVP Scope

**File:** `/docs/02-mvp-scope.md`  
**Product:** DevDeck  
**Scope Level:** MVP  
**Goal:** Define exactly what the first useful version of DevDeck should and should not include.

---

## 1. MVP Summary

The MVP of DevDeck is a **local-first developer cockpit** that lets a developer start multiple local services, stream their logs into one browser dashboard, visually separate those logs by service, and quickly identify errors during the current development session.

The MVP should not attempt to become a production observability platform, a log database, or a full monitoring suite.

The first version should answer one simple question extremely well:

> When I am developing locally, can I see what all my services are doing without juggling five terminal tabs?

---

## 2. MVP Promise

The MVP promise is:

> Run your local stack with one command and view all service logs in one clean dashboard.

A user should be able to:

1. define the services in their project
2. run one DevDeck command
3. have DevDeck start those services
4. open a local dashboard
5. see live logs from each service
6. identify errors and warnings quickly
7. copy useful debug context when something breaks

If the MVP does this reliably and beautifully, it is successful.

---

## 3. Target MVP User

The MVP is designed for developers working on local projects with more than one running process.

### Primary MVP User

A full-stack developer working on a project such as:

- Next.js frontend + Express backend
- React/Vite frontend + FastAPI backend
- frontend + backend + worker
- app server + queue consumer
- AI app with ingestion or background jobs
- hackathon project with multiple local commands

This user is not asking for enterprise-grade observability. They want a calmer and faster local debugging experience.

---

## 4. Core MVP Scenario

A developer has a project with three local services:

- `web` — frontend dev server
- `api` — backend API server
- `worker` — background job processor

Normally, they would open three terminals and run three commands manually.

With DevDeck, they define those services once and run:

```bash
npx devdeck dev
```

DevDeck starts the services and opens a local dashboard.

The dashboard shows:

- which services are running
- which services failed
- which ports are reachable
- live logs from each service
- a merged timeline of all logs
- highlighted errors and warnings
- basic search and filtering
- copy/export options for debugging

---

## 5. MVP Design Principles

### 1. Local-first by default

DevDeck should run entirely on the user's machine.

There should be no required account, hosted backend, cloud workspace, or external service dependency.

### 2. Zero persistent storage by default

The MVP should not store logs permanently.

Logs should only exist for the current development session unless the user explicitly exports them.

This keeps the product lightweight and avoids privacy, retention, and database complexity.

### 3. Process-first model

The core unit in DevDeck is a local service/process, not a port.

A service may have a port, but it does not need one.

This is important because workers, queue consumers, scripts, and ingestion jobs often do not expose HTTP ports.

### 4. Visual clarity over advanced observability

The MVP should optimize for clarity:

- what is running
- what failed
- where the error happened
- what happened recently
- what context should be copied for debugging

It should not optimize for complex dashboards, long-term analytics, or production-scale monitoring.

### 5. Minimal setup friction

The first useful experience should be fast.

A developer should not need to understand observability concepts, agents, exporters, or query languages to use DevDeck.

### 6. Beautiful, but not decorative

The UI should look polished, but every visual element should serve debugging speed.

A beautiful dashboard that does not help developers find problems faster is not a successful MVP.

---

## 6. In-Scope MVP Features

### 6.1 Project Initialization

DevDeck should provide a simple way to initialize configuration for a project.

The user should be able to create a DevDeck config file that lists the local services they want to run.

The config should be human-readable and easy to edit manually.

MVP expectation:

- create a starter config
- allow the user to define service names
- allow the user to define commands
- allow optional working directories
- allow optional ports

The config does not need to support every advanced use case in the first version.

---

### 6.2 Multi-Service Runner

DevDeck should be able to start multiple local services from one command.

Each service should run as a separate child process.

MVP expectation:

- start all configured services
- capture standard output and standard error
- show process status
- detect process exits
- allow the user to stop all services cleanly
- allow restarting an individual service from the dashboard or CLI if feasible

The first version should prioritize reliability over advanced process orchestration.

---

### 6.3 Local Dashboard

DevDeck should open a browser-based dashboard for the current development session.

The dashboard should be served locally.

MVP expectation:

- dashboard opens automatically or provides a clear local URL
- works without login
- shows services and logs in real time
- remains usable during active log streaming
- handles moderate log volume without freezing

---

### 6.4 Live Log Streaming

DevDeck should stream logs from running services into the dashboard as they happen.

MVP expectation:

- show live stdout and stderr output
- preserve service identity for each log line
- show timestamps or relative timing
- support a unified cross-service stream
- support viewing logs for a single service
- keep recent logs available during the session

The MVP should use an in-memory current-session buffer rather than permanent storage.

---

### 6.5 Service Sidebar

The dashboard should include a service overview area.

MVP expectation:

Each service should display:

- service name
- running/stopped/failed state
- optional port
- health indicator if a port is configured
- recent error/warning count

This gives the developer a quick answer to:

> Is everything running, and where should I look first?

---

### 6.6 Log Highlighting

DevDeck should perform lightweight log classification.

MVP expectation:

Identify and visually distinguish common signals such as:

- errors
- warnings
- successful startup messages
- failed builds
- HTTP status codes
- local URLs
- stack traces
- JSON-like log lines

This should remain best-effort. DevDeck should not try to perfectly parse every framework's log format in the MVP.

---

### 6.7 Search and Filters

The dashboard should let users narrow down the current session's logs.

MVP expectation:

- search by text
- filter by service
- filter by severity such as error/warning/info
- quickly jump to recent errors
- clear search/filter state easily

This does not need to be a full query language.

Simple search is enough for the MVP.

---

### 6.8 Port Awareness and Health Checks

If a service has a configured port, DevDeck should use it to improve the local dev experience.

MVP expectation:

- show clickable local URLs
- indicate whether the port appears reachable
- visually show starting/running/unreachable states
- avoid treating missing ports as a failure for services that do not need ports

Ports are useful metadata, not the foundation of the product.

---

### 6.9 Copy Debug Context

DevDeck should help users copy relevant debugging information quickly.

MVP expectation:

A user should be able to copy a compact debug bundle containing:

- service name
- recent related logs
- visible error or warning
- command/process context
- timestamp/session context

This should be deterministic and simple.

The MVP does not need AI-generated explanations.

The value is in gathering useful context quickly, especially for pasting into AI coding tools, GitHub issues, Slack, or personal notes.

---

### 6.10 Export Current Session

DevDeck should allow users to export logs from the current session.

MVP expectation:

- export readable text
- optionally export structured session data
- include service names and timestamps
- avoid background persistence unless the user explicitly exports

This supports sharing and debugging without turning DevDeck into a storage platform.

---

## 7. Out-of-Scope for MVP

The following are intentionally not part of the first MVP.

### 7.1 Production Log Collection

DevDeck should not collect production logs in the MVP.

No agents, cloud collectors, deployment integrations, or production dashboards.

---

### 7.2 Long-Term Log Storage

The MVP should not include persistent databases, retention policies, indexing systems, or historical log search.

Current-session memory and explicit export are enough.

---

### 7.3 Cloud Accounts and Team Workspaces

The MVP should not include:

- user accounts
- authentication
- organizations
- team sharing
- hosted projects
- billing

These features would create unnecessary product and engineering overhead.

---

### 7.4 Advanced Observability

The MVP should not include:

- metrics dashboards
- tracing
- alerting
- incident timelines
- uptime monitoring
- SLO/SLA tracking
- anomaly detection

These belong to mature observability platforms and are not needed for the core local dev loop.

---

### 7.5 Browser Console Capture

Browser console capture is an important future direction, but it should stay out of the MVP.

Reasons:

- Chrome DevTools Protocol integration adds complexity
- browser launching behavior can be fragile
- source maps and runtime contexts complicate the experience
- cross-browser support becomes a separate product surface
- security and privacy expectations become more sensitive

Future DevDeck can explore this as a major differentiator.

For MVP, DevDeck should focus on local process logs first.

---

### 7.6 Docker-First Experience

Docker support is useful, but the MVP should not be Docker-first.

The first version may support Docker commands if the user defines them as normal services, but DevDeck should not initially build deep container orchestration features.

Future versions can support Docker Compose awareness, container status, and container log adapters.

---

### 7.7 AI Debugging Agent

The MVP should not include an autonomous debugging agent.

It should not promise to diagnose bugs, edit code, or automatically fix errors.

The MVP can help users copy clean debugging context, which is already valuable for AI-assisted workflows.

---

### 7.8 Plugin System

The MVP should not include a formal plugin system.

Extensibility can come later after the core product experience is proven.

---

## 8. MVP User Experience Requirements

### 8.1 First Run Experience

A new user should be able to:

1. install or run DevDeck
2. create a config
3. define two or three services
4. start DevDeck
5. see logs in the dashboard

This should feel straightforward and not require reading a long manual.

---

### 8.2 Daily Use Experience

A returning user should run one command and get back into their local development environment quickly.

The happy path should feel like:

```bash
npx devdeck dev
```

Then DevDeck starts the local stack and opens the dashboard.

---

### 8.3 Failure Experience

When something fails, DevDeck should make the failure obvious.

Examples:

- a service fails to start
- a service exits unexpectedly
- a port is already in use
- a command is invalid
- a backend returns repeated errors
- a worker crashes

The user should not need to search through noisy logs to notice that something is wrong.

---

### 8.4 Recovery Experience

The MVP should support basic recovery actions.

Examples:

- restart a service
- clear current logs
- stop all services
- copy the relevant error context
- open the local service URL

DevDeck does not need to automatically fix problems.

It should make manual debugging faster.

---

## 9. MVP Acceptance Criteria

The MVP can be considered complete when the following are true.

### Setup

- A user can create a DevDeck project config.
- The config can define at least three services.
- Each service can have a command, optional working directory, and optional port.

### Running Services

- DevDeck can start all configured services from one command.
- DevDeck can capture stdout and stderr from each service.
- DevDeck can stop services when the session ends.
- DevDeck can detect when a service exits or fails.

### Dashboard

- A local dashboard is available during the session.
- The dashboard shows all configured services.
- The dashboard streams logs in real time.
- The dashboard supports a unified stream and service-specific views.

### Debugging

- Errors and warnings are visually distinguishable.
- The user can filter logs by service.
- The user can search current-session logs.
- The user can copy debug context.
- The user can export current-session logs.

### Performance and Reliability

- The dashboard remains responsive with moderate log volume.
- Logs do not need to be stored permanently.
- A broken service should not crash the entire DevDeck session.
- DevDeck should provide useful feedback when commands fail.

---

## 10. MVP Demo Requirements

The MVP should ship with a strong demo project or example setup.

The demo should include:

- frontend service
- backend service
- worker service
- intentional backend error
- intentional worker log
- successful startup logs
- warning logs
- copy debug context flow

The demo should be designed for the README and screen recording.

The goal is that someone can watch the demo and immediately understand:

> This replaces my messy terminal setup.

---

## 11. Recommended MVP Repo Experience

The repository should make the product feel polished from day one.

Recommended repo contents:

- clear README
- demo GIF or video
- installation instructions
- quickstart guide
- example config
- example full-stack project
- screenshots
- contribution guide
- roadmap
- known limitations

For an open-source devtool, the README is part of the product.

---

## 12. MVP Risks and Guardrails

### Risk: The product becomes too broad

Guardrail:

Keep repeating the MVP promise:

> One command. Multiple local services. One dashboard.

If a feature does not support that promise, defer it.

---

### Risk: Too much schema/API design too early

Guardrail:

Use simple, human-readable config and internal event handling.

Avoid over-documenting internal contracts before the product behavior is proven.

The docs should describe user-visible behavior more than internal protocols.

---

### Risk: UI polish delays functionality

Guardrail:

Prioritize the happy path first:

- start services
- stream logs
- identify errors
- stop cleanly

Then polish the dashboard.

---

### Risk: Process management gets messy

Guardrail:

Start with common local commands and clear limitations.

Handle the mainstream case first before supporting every shell, platform, and process tree edge case.

---

### Risk: The tool feels like a wrapper around `concurrently`

Guardrail:

The dashboard must provide obvious value beyond prefixed terminal output.

That value should come from:

- visual service states
- error surfacing
- search/filtering
- health checks
- debug context copying
- clean UX

---

## 13. MVP Success Definition

The MVP succeeds if a developer with a three-service local app says:

> I would rather run this than open three terminals manually.

That is the bar.

Not enterprise adoption.

Not production observability.

Not feature completeness.

The first version wins if it becomes a small but genuinely useful part of a developer's daily local workflow.

