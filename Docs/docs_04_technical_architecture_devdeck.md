# DevDeck — Technical Architecture

**File:** `/docs/04-technical-architecture.md`  
**Product:** DevDeck  
**Scope Level:** MVP Architecture  
**Goal:** Define the technical shape of DevDeck’s MVP without over-specifying low-level schemas, APIs, or internal contracts.

---

## 1. Architecture Summary

DevDeck is a local-first developer tool made of three major parts:

1. **CLI runner** — starts and manages local services
2. **Local session server** — streams runtime events to the dashboard
3. **Browser dashboard** — visualizes service state and live logs

At a high level:

```txt
Project config
    ↓
DevDeck CLI
    ↓
Local service processes
    ↓
stdout/stderr capture
    ↓
In-memory session buffer
    ↓
Local WebSocket/HTTP server
    ↓
Browser dashboard
```

The MVP should avoid persistent storage, hosted infrastructure, cloud accounts, production agents, and heavyweight observability concepts.

DevDeck should feel technically simple:

> Read config. Start services. Capture logs. Stream to dashboard. Help the developer debug faster.

---

## 2. Core Architectural Principles

### 2.1 Local-First

Everything in the MVP should run on the developer’s machine.

DevDeck should not require:

- cloud login
- hosted backend
- remote workspace
- account creation
- telemetry pipeline
- database setup

The dashboard should be served locally and should only show the current local session.

---

### 2.2 Zero Persistent Storage by Default

The MVP should not persist logs automatically.

Logs should live in memory during the active session.

If the user wants to keep logs, they can explicitly export them.

This keeps the architecture simple and avoids early complexity around:

- retention
- indexing
- privacy
- encryption
- storage limits
- secret leakage
- database migrations

---

### 2.3 Process-First Architecture

The primary unit is a **service process**, not a port.

A service is something DevDeck can run and observe.

Examples:

- frontend dev server
- backend API server
- Python worker
- queue consumer
- local script
- Docker command
- model server
- webhook listener

Ports are optional metadata.

This distinction matters because many valuable local services do not expose ports.

---

### 2.4 Current-Session Focus

DevDeck is not trying to answer:

> What happened across my infrastructure over the last 30 days?

It is trying to answer:

> What is happening in my local dev session right now?

The architecture should therefore optimize for:

- fast startup
- live streaming
- low latency
- easy cleanup
- useful current-session memory
- readable export

---

### 2.5 Prefer Boring Reliability

The MVP should prioritize reliable service running and log streaming over advanced features.

A beautiful dashboard is useless if DevDeck cannot safely start, stop, and observe processes.

The technical foundation must handle the mainstream case well before chasing edge cases.

---

## 3. Recommended MVP Tech Stack

### 3.1 Language and Runtime

Recommended MVP stack:

- **TypeScript** for the CLI, server, and dashboard
- **Node.js** runtime for process management and npm distribution
- **React** for the dashboard UI
- **Vite** for frontend development/building

Reasoning:

- fast to build
- natural fit for JavaScript/TypeScript developers
- easy `npx`-based distribution
- strong ecosystem for CLI tooling
- easy local WebSocket/HTTP server setup
- good developer familiarity

DevDeck can later consider Go or Rust for a single-binary distribution, but TypeScript is the fastest path to a polished MVP.

---

### 3.2 CLI and Server

Recommended choices:

- CLI framework: lightweight TypeScript CLI library
- local server: minimal HTTP server
- realtime transport: WebSocket
- process execution: Node child process utilities
- config parsing: YAML-first, with possible JSON support later

The goal is not to create a complex backend.

The local server exists mainly to:

- serve the dashboard
- stream session events
- expose lightweight local control actions
- coordinate session state

---

### 3.3 Dashboard UI

Recommended choices:

- React
- Tailwind CSS
- component primitives such as shadcn/ui if useful
- virtualized log list for performance
- lightweight state management

The dashboard should be optimized for readability and responsiveness.

Log rendering performance matters because logs can become noisy quickly.

---

## 4. Major Components

The MVP can be organized into the following components.

---

## 4.1 CLI Entrypoint

### Responsibility

The CLI is the main way users interact with DevDeck from their project.

It should support commands such as:

- initialize project config
- start a dev session
- stop session through terminal interruption
- optionally print session status

### MVP Behavior

When the user starts a session, the CLI should:

1. locate the project config
2. validate the basic config shape
3. start the local session server
4. start configured services
5. stream service output into the session pipeline
6. open or display the local dashboard URL
7. handle shutdown signals cleanly

The CLI should remain simple and understandable.

It should not become a large terminal UI in the MVP.

---

## 4.2 Config Loader

### Responsibility

The config loader reads the project’s DevDeck configuration.

The config should define the services DevDeck needs to run.

### MVP Behavior

The config should support:

- project name
- service names
- service commands
- optional working directories
- optional ports
- optional display metadata

The exact config format should remain simple and human-readable.

The architecture should avoid over-engineering config schemas too early.

### Guardrail

Do not design an advanced configuration language in the MVP.

The config exists to get local services running, not to model every possible development environment.

---

## 4.3 Process Manager

### Responsibility

The process manager starts, tracks, and stops local service processes.

This is one of the most important parts of the MVP.

### MVP Behavior

The process manager should:

- start each configured service
- keep service identity attached to output
- capture stdout and stderr
- detect process exit
- mark crashes or failures
- support stopping all services
- support restarting individual services if feasible

### Key Challenge

Process management can get messy across platforms.

Important edge cases include:

- commands that spawn child processes
- processes that do not exit cleanly
- commands that rely on shell behavior
- ports already in use
- services that take time to start
- interrupt handling

The MVP should handle the common path well and document limitations honestly.

---

## 4.4 Log Ingestion Pipeline

### Responsibility

The log ingestion pipeline receives raw output from service processes and turns it into displayable log events.

### MVP Behavior

The pipeline should:

- receive stdout/stderr chunks
- split output into readable lines where appropriate
- preserve service identity
- attach timing information
- classify obvious severity levels
- detect useful patterns such as URLs, errors, warnings, and stack traces
- push events into the in-memory session buffer
- broadcast events to the dashboard

### Guardrail

The parser should be best-effort.

DevDeck should not attempt to perfectly understand every framework or log format in the MVP.

The right MVP approach is:

> Preserve raw logs first. Add helpful highlighting second.

---

## 4.5 Session State Manager

### Responsibility

The session state manager tracks the current state of the DevDeck session.

This includes:

- active services
- service statuses
- recent logs
- error and warning counts
- port health states
- session start time
- dashboard clients

### MVP Behavior

The session state should live in memory.

It should be sufficient for:

- rendering the dashboard
- showing current service status
- filtering/searching current logs
- copying debug context
- exporting the current session

### Log Buffer Strategy

Use a bounded in-memory buffer.

The buffer should prevent unlimited memory growth during noisy sessions.

The product does not need a database for MVP.

---

## 4.6 Local Dashboard Server

### Responsibility

The local server connects the CLI/runtime world to the browser dashboard.

### MVP Behavior

The server should:

- serve the dashboard UI locally
- maintain a realtime connection to the dashboard
- send initial session state when the dashboard opens
- stream new logs and service updates
- receive lightweight dashboard actions

Examples of lightweight actions:

- restart service
- stop service
- clear visible logs
- export session
- copy context support

The server should remain local-only by default.

---

## 4.7 Dashboard Client

### Responsibility

The dashboard visualizes the current DevDeck session.

### MVP Behavior

The dashboard should:

- show all services
- show live logs
- provide unified and service-specific views
- show service status
- highlight errors and warnings
- provide search and filters
- support copy debug context
- support session export
- remain responsive during streaming

### Performance Requirement

The dashboard should avoid rendering every log line naively when log volume grows.

A virtualized log view is recommended for the MVP.

---

## 4.8 Health Checker

### Responsibility

The health checker monitors optional local ports associated with services.

### MVP Behavior

If a service has a configured port, DevDeck should periodically check whether the service appears reachable.

This can power UI states such as:

- starting
- reachable
- unreachable
- possibly crashed

### Guardrail

A port check should not be the only definition of service health.

Some services do not expose ports, and some services take time before becoming reachable.

---

## 4.9 Export and Debug Context Builder

### Responsibility

This component prepares useful output from the current session.

### MVP Behavior

It should support:

- copy selected logs
- copy debug context
- export current session logs

The output should be readable and practical.

### Guardrail

The MVP should not generate AI explanations or claim to diagnose the root cause automatically.

The first version should focus on collecting clean context.

---

## 5. Runtime Flow

### 5.1 Starting a Session

Typical startup flow:

```txt
User runs devdeck dev
    ↓
CLI loads config
    ↓
CLI starts local session server
    ↓
CLI starts configured services
    ↓
Process manager captures output
    ↓
Log pipeline processes output
    ↓
Session state updates
    ↓
Dashboard receives realtime updates
```

The user sees the dashboard and begins coding.

---

### 5.2 Streaming Logs

Typical log flow:

```txt
Service writes stdout/stderr
    ↓
Process manager captures output
    ↓
Log pipeline normalizes and classifies it
    ↓
Session buffer stores recent event
    ↓
Realtime server broadcasts event
    ↓
Dashboard renders log line
```

The raw message should always remain available, even if classification is imperfect.

---

### 5.3 Service Failure

Typical failure flow:

```txt
Service exits or emits error
    ↓
Process manager detects status change
    ↓
Session state marks service as failed/crashed
    ↓
Dashboard updates service indicator
    ↓
User can inspect logs or restart service
```

A failed service should not crash the entire DevDeck session.

---

### 5.4 Stopping a Session

Typical shutdown flow:

```txt
User stops session
    ↓
DevDeck sends stop signal to services
    ↓
Process manager waits briefly for clean exits
    ↓
Remaining processes are force-stopped if needed
    ↓
Dashboard/session server shuts down
    ↓
CLI exits
```

Clean shutdown is important because zombie local processes are a terrible developer experience.

---

## 6. Data and State Model — High Level

The MVP needs only a few high-level concepts:

### Project

The local project using DevDeck.

### Service

A configured local process DevDeck can run and observe.

### Session

One active DevDeck run.

### Log Event

A piece of output or runtime information associated with a service.

### Service Status

The current state of a service, such as starting, running, stopped, or crashed.

### Health State

Optional status derived from a configured port or reachability check.

These concepts are enough for the MVP.

Avoid over-specifying exact internal event shapes until implementation requires it.

---

## 7. Storage Strategy

### 7.1 MVP Storage

The MVP should use memory only.

Store recent session data in bounded buffers.

This includes:

- recent logs
- service statuses
- counters
- health states
- session metadata

---

### 7.2 Export

Export should be explicit.

When the user chooses to export, DevDeck can write current-session logs to a local file.

This is not the same as persistent logging.

---

### 7.3 Future Storage

Future versions may add optional local persistence.

Possible future modes:

- save last session automatically
- store sessions locally
- searchable local history
- project-level debug history

These should be optional and not part of the MVP.

---

## 8. Realtime Communication

The MVP should use a realtime connection between the local server and browser dashboard.

Recommended approach:

- HTTP for serving the dashboard and simple local actions
- WebSocket for logs and live state updates

The architecture should keep this simple.

Do not overbuild a complex internal protocol in the MVP.

The dashboard needs to receive:

- initial session state
- new log events
- service status updates
- health updates
- action feedback

That is enough.

---

## 9. Log Classification Strategy

DevDeck should preserve raw logs and add lightweight classification.

### MVP Classification Targets

Best-effort detection for:

- errors
- warnings
- info lines
- success/startup lines
- stack traces
- local URLs
- HTTP methods/status codes
- JSON-like logs
- build failures
- process exits

### Important Guardrail

Classification should improve readability, not become a fragile parser project.

If a log line cannot be classified, DevDeck should still display it normally.

Raw truth beats smart but wrong parsing.

---

## 10. Platform Considerations

### 10.1 macOS and Linux

The first MVP should work well on macOS and Linux because these are common development environments for the target audience.

### 10.2 Windows

Windows support is valuable but may require extra care around shell behavior, process trees, and command execution.

The MVP should either support Windows properly or clearly document any limitations.

Do not silently provide a broken Windows experience.

---

## 11. Security and Privacy Considerations

Even though DevDeck is local-only, logs can contain sensitive data.

The MVP should follow a few basic rules:

- do not send logs to external services
- do not require accounts
- do not persist logs by default
- make exports explicit
- keep the dashboard bound to local access by default
- avoid unnecessary telemetry in the MVP

Future cloud or sharing features would require a much deeper security model.

---

## 12. Error Handling Philosophy

DevDeck should provide direct, actionable error messages.

Common failure cases:

- config not found
- invalid config
- command not found
- working directory missing
- service exits immediately
- dashboard port unavailable
- service port unreachable
- process cannot be stopped cleanly

For each failure, DevDeck should aim to explain:

1. what happened
2. which service or part failed
3. what the user can try next

Avoid dumping low-level stack traces unless debug mode is enabled.

---

## 13. Performance Considerations

The MVP should remain responsive during normal development log volume.

Key performance concerns:

- excessive log rendering in the browser
- unbounded memory growth
- high-frequency WebSocket updates
- very noisy services
- expensive search over large buffers

Recommended guardrails:

- bounded in-memory log buffers
- batched log updates if needed
- virtualized log list
- simple search over current buffer
- clear visible limits in the UI if necessary

The product should feel instant during everyday use.

---

## 14. Future Architecture Extensions

These should be considered future scope, not MVP requirements.

### 14.1 Browser Console Capture

Potential approaches:

- Chrome DevTools Protocol
- injected client script
- browser extension
- framework plugin

This could eventually unify frontend runtime errors with backend and worker logs.

It is a major differentiator but should not block the MVP.

---

### 14.2 Docker Adapter

Future Docker support could include:

- Docker Compose service discovery
- container log streaming
- container status
- restart container actions
- mixed local process and container views

For MVP, Docker commands can be treated as normal configured services if needed.

---

### 14.3 Local Persistence

Future versions may support optional local session history.

This could help users revisit previous debugging sessions.

However, this should be opt-in because logs may contain secrets.

---

### 14.4 OpenTelemetry Compatibility

Future versions may explore compatibility with OpenTelemetry-style logs or traces.

This should be approached carefully.

The goal should be to enhance local debugging, not turn DevDeck into a production observability platform.

---

### 14.5 AI Debug Workflows

Future DevDeck could prepare richer context for AI coding agents.

Possible features:

- AI-ready debug bundles
- prompt templates
- root-cause hinting
- integration with local coding agents

The MVP should only copy clean context and avoid making unsupported diagnostic claims.

---

## 15. Recommended Folder Structure

A possible repo structure:

```txt
devdeck/
  apps/
    dashboard/
  packages/
    cli/
    core/
    server/
    config/
    ui/
  examples/
    fullstack-basic/
    ai-worker-demo/
  docs/
    01-product-one-pager.md
    02-mvp-scope.md
    03-user-flows-and-screens.md
    04-technical-architecture.md
    05-build-plan.md
```

This structure is only a recommendation.

The implementation should stay flexible while the MVP is being built.

---

## 16. Build Order Recommendation

The technical build should happen in this order:

1. config loading
2. process running
3. stdout/stderr capture
4. in-memory session state
5. local server
6. realtime dashboard updates
7. dashboard UI
8. search/filtering
9. health checks
10. copy/export flows
11. polish and demo project

This order reduces risk because it proves the core runtime before investing heavily in UI polish.

---

## 17. Architecture Risks

### Risk 1: Process management becomes harder than expected

Mitigation:

Start with common commands and make shutdown behavior reliable before supporting advanced orchestration.

---

### Risk 2: Dashboard performance degrades with noisy logs

Mitigation:

Use bounded buffers, avoid naive rendering, and design around current-session limits.

---

### Risk 3: Classification becomes too complex

Mitigation:

Keep raw logs as the source of truth and treat classification as optional enhancement.

---

### Risk 4: Scope expands toward production observability

Mitigation:

Keep the architecture local, ephemeral, and session-focused.

---

### Risk 5: Future features distort MVP design

Mitigation:

Design extension points conceptually, but do not build plugins, browser integrations, cloud sync, or persistence until the core product is validated.

---

## 18. Final Architecture Statement

DevDeck’s MVP architecture should be simple, local, and robust.

It should not be impressive because it has complex infrastructure.

It should be impressive because it makes a messy local development workflow feel clean.

The technical north star is:

> Start local services, capture their output, stream it to one dashboard, and make failures obvious.

Everything else can come later.

