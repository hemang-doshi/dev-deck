# DevDeck — Build Plan

**File:** `/docs/05-build-plan.md`  
**Product:** DevDeck  
**Scope Level:** MVP Execution Plan  
**Goal:** Break DevDeck into clear implementation phases that can be built quickly without scope creep.

---

## 1. Build Plan Summary

The goal of the MVP build is to ship a working local-first DevDeck prototype that can:

1. read a project config
2. start multiple local services
3. capture their logs
4. stream those logs to a local dashboard
5. show service status clearly
6. highlight errors and warnings
7. support basic filtering/search
8. copy/export useful debugging context

The build should prioritize the core runtime before heavy UI polish.

A beautiful dashboard matters, but DevDeck is only valuable if it reliably starts services and streams logs.

The build philosophy:

> Make it work. Make it reliable. Make it beautiful. Then make it demo-worthy.

---

## 2. MVP Build Priorities

The MVP should be built in this priority order:

1. **Service runner reliability**
2. **Live log streaming**
3. **Dashboard visibility**
4. **Error/warning surfacing**
5. **Search, filtering, and debug context**
6. **UX polish and demo quality**

Avoid building future-scope features before the core loop works.

---

## 3. Non-Negotiable MVP Loop

Before adding advanced features, this loop must work:

```bash
npx devdeck dev
```

DevDeck should:

1. read config
2. start services
3. capture logs
4. open dashboard
5. show live logs
6. show service status
7. stop services cleanly

This is the foundation.

If this is weak, the rest of the product does not matter.

---

## 4. Recommended Build Phases

The MVP should be built in seven phases:

1. Foundation and repo setup
2. Config and CLI
3. Process runner and log capture
4. Local server and realtime session
5. Dashboard MVP
6. Debugging features
7. Polish, demo, and release prep

Each phase should produce something usable, not just internal code.

---

# Phase 1 — Foundation and Repo Setup

## 1.1 Goal

Create a clean project foundation that supports CLI, dashboard, shared logic, examples, and docs.

---

## 1.2 Tasks

- initialize repository
- set up TypeScript
- set up package manager workspace
- create basic folder structure
- set up linting/formatting
- set up build scripts
- add initial README
- add docs folder
- add example project folder

Recommended structure:

```txt
devdeck/
  apps/
    dashboard/
  packages/
    cli/
    core/
    server/
    config/
  examples/
    fullstack-basic/
  docs/
```

This structure can evolve, but the first version should keep concerns separated enough to avoid chaos.

---

## 1.3 Definition of Done

Phase 1 is done when:

- the repo can install dependencies successfully
- TypeScript builds without errors
- basic scripts exist for development
- docs are committed in `/docs`
- there is a placeholder CLI package
- there is a placeholder dashboard app
- there is at least one example project folder

---

## 1.4 Risks

### Risk: Over-engineering the monorepo

Avoid spending too much time on perfect package boundaries.

The structure should help the MVP, not become the project.

---

# Phase 2 — Config and CLI

## 2.1 Goal

Allow a user to initialize DevDeck in a project and start a session from the terminal.

---

## 2.2 User-Facing Commands

The MVP should support:

```bash
npx devdeck init
npx devdeck dev
```

`init` creates a starter config.

`dev` starts the local development session.

---

## 2.3 Tasks

- implement CLI entrypoint
- implement `init` command
- generate starter config
- implement config discovery
- implement basic config validation
- implement `dev` command skeleton
- print clear CLI messages
- handle missing config gracefully

The config should stay simple and human-readable.

Do not spend too much time designing a perfect schema.

---

## 2.4 Expected User Experience

A user should be able to run:

```bash
npx devdeck init
```

Then edit the generated config with services like:

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

Then run:

```bash
npx devdeck dev
```

At this phase, `dev` may only print the parsed service list.

---

## 2.5 Definition of Done

Phase 2 is done when:

- `devdeck init` creates a usable config file
- `devdeck dev` can locate and read the config
- invalid/missing config gives helpful messages
- service definitions are loaded correctly
- the CLI output is readable and not noisy

---

## 2.6 Risks

### Risk: Too much config design too early

The config only needs to support the MVP service runner.

Advanced config features should be deferred.

---

# Phase 3 — Process Runner and Log Capture

## 3.1 Goal

Start multiple configured services and capture their stdout/stderr output.

This is the most important technical phase.

---

## 3.2 Tasks

- start each configured service as a child process
- attach service identity to each process
- capture stdout
- capture stderr
- detect process start
- detect process exit
- detect obvious crashes
- handle command failures
- support stopping all services
- handle terminal interrupt cleanly
- print prefixed logs in the CLI as a fallback

---

## 3.3 Expected User Experience

The user runs:

```bash
npx devdeck dev
```

DevDeck starts all configured services and prints readable prefixed logs:

```txt
[web]    ready on http://localhost:3000
[api]    server listening on 8000
[worker] started queue consumer
```

If a service fails:

```txt
[api] service exited with code 1
```

The user can press `Ctrl+C`, and DevDeck attempts to stop all services.

---

## 3.4 Definition of Done

Phase 3 is done when:

- DevDeck can start at least three configured services
- logs from each service are captured
- logs are tagged by service
- stdout and stderr are both captured
- service exits are detected
- broken commands produce clear errors
- `Ctrl+C` stops the session cleanly in common cases
- the CLI fallback output is usable

---

## 3.5 Risks

### Risk: Process cleanup is unreliable

This is a major risk.

Do not ignore it.

A devtool that leaves zombie processes behind will feel untrustworthy.

Start with simple cleanup and improve over time.

---

# Phase 4 — Local Server and Realtime Session

## 4.1 Goal

Create the local session server that connects runtime events to the browser dashboard.

---

## 4.2 Tasks

- start a local HTTP server
- serve the dashboard shell
- create realtime connection for dashboard updates
- maintain in-memory session state
- store recent logs in a bounded buffer
- broadcast new log events to connected dashboard clients
- broadcast service status changes
- expose simple local actions if needed
- handle dashboard reconnects gracefully

---

## 4.3 Expected User Experience

The CLI starts the session and prints:

```txt
DevDeck dashboard: http://localhost:4545
```

When the user opens the dashboard, they see the active session and live logs.

---

## 4.4 Definition of Done

Phase 4 is done when:

- DevDeck starts a local dashboard server
- dashboard clients can connect to the session
- live logs are streamed to connected clients
- new clients receive recent session state
- service status changes are streamed
- the server does not require accounts or cloud access
- the in-memory buffer prevents unlimited log growth

---

## 4.5 Risks

### Risk: Realtime layer becomes overcomplicated

Keep it simple.

The MVP only needs current-session state, live logs, and basic service updates.

Do not design a complex protocol too early.

---

# Phase 5 — Dashboard MVP

## 5.1 Goal

Build the first useful browser dashboard.

The dashboard should make the DevDeck session visually understandable.

---

## 5.2 Core Screens

The MVP dashboard should include:

- session dashboard
- service detail/focused view
- search and filter state
- empty state
- service failure state

This can all live inside a single-page dashboard.

---

## 5.3 Tasks

- create dashboard layout
- add service sidebar
- add unified log stream
- add service-specific filtering
- show service status
- show port/link if configured
- show error and warning counts
- support auto-scroll behavior
- support paused scrolling when user scrolls upward
- add clear logs action
- handle empty/no logs state
- handle disconnected dashboard state

---

## 5.4 Suggested Layout

```txt
┌─────────────────────────────────────────────────────────────┐
│ Top Bar: Project name, session status, actions              │
├───────────────┬─────────────────────────────────────────────┤
│ Services      │ Unified Log Stream                          │
│               │                                             │
│ ● web         │ [web] ready on localhost:3000               │
│ ● api         │ [api] GET /health 200                       │
│ ● worker      │ [worker] job processed                      │
│               │                                             │
└───────────────┴─────────────────────────────────────────────┘
```

The layout should be clean and immediately understandable.

---

## 5.5 Definition of Done

Phase 5 is done when:

- dashboard displays active services
- dashboard displays live logs
- user can filter by service
- service status is visible at a glance
- errors/warnings have visual emphasis
- dashboard remains responsive during normal log streaming
- dashboard feels meaningfully better than terminal-only output

---

## 5.6 Risks

### Risk: UI becomes pretty but not useful

Every UI element should help the user answer:

- what is running?
- what broke?
- where should I look?
- what happened recently?

Avoid decorative dashboard clutter.

---

# Phase 6 — Debugging Features

## 6.1 Goal

Add the features that make DevDeck useful during actual debugging, not just log viewing.

---

## 6.2 Tasks

- implement lightweight severity detection
- highlight errors and warnings
- detect common local URLs
- detect obvious stack traces
- add text search
- add severity filters
- add jump-to-recent-error behavior if feasible
- add copy selected logs
- add copy debug context
- add export current session
- add restart service action if not already done
- add basic port health checks

---

## 6.3 Copy Debug Context Requirements

The copied debug context should be compact, readable, and useful.

It should include:

- project/session context
- affected service
- recent logs around the issue
- visible error/warning lines
- service status
- command summary if useful

It should not be a massive raw dump.

The goal is to make it easy to paste into:

- AI coding agents
- GitHub issues
- Slack messages
- personal notes

---

## 6.4 Export Requirements

Export should be explicit and current-session only.

Export should support a readable format first.

A structured export can be added if easy, but it should not delay the MVP.

---

## 6.5 Port Health Checks

If a service has a configured port, DevDeck should show whether it appears reachable.

This should be treated as helpful status, not the only definition of service health.

---

## 6.6 Definition of Done

Phase 6 is done when:

- errors and warnings are visually distinct
- user can search logs
- user can filter by severity
- user can copy debug context
- user can export current session logs
- configured ports show useful reachability state
- user can restart a failed service if restart support is included

---

## 6.7 Risks

### Risk: Debug context becomes too magical

Do not overpromise.

The MVP should collect context, not claim to solve the bug.

---

# Phase 7 — Polish, Demo, and Release Prep

## 7.1 Goal

Turn the working MVP into something that feels shippable, demo-worthy, and open-source friendly.

---

## 7.2 Tasks

- polish dashboard visual design
- improve empty states
- improve error states
- improve CLI wording
- improve setup messages
- create demo project
- record demo GIF/video
- write strong README
- add quickstart instructions
- add known limitations
- add contribution guide
- add roadmap
- test on at least one real multi-service project
- fix rough edges from real usage

---

## 7.3 Demo Project Requirements

The demo project should include:

- frontend service
- backend service
- worker service
- intentional backend error
- intentional warning
- successful startup logs
- port links
- copy debug context flow

The demo should tell a clear story:

> DevDeck replaces terminal chaos with one clean local dashboard.

---

## 7.4 README Requirements

The README should include:

- clear tagline
- short problem statement
- demo GIF
- install/run instructions
- example config
- feature list
- screenshots
- MVP limitations
- roadmap
- contribution instructions

For DevDeck, the README is part of the product experience.

---

## 7.5 Definition of Done

Phase 7 is done when:

- the dashboard looks polished
- the CLI feels clear
- demo project runs reliably
- README explains the product quickly
- a first-time user can run the demo without confusion
- known limitations are documented honestly
- the project feels ready to share publicly

---

# 5. Suggested Milestones

## Milestone 1 — Terminal-Only Prototype

### Goal

Prove DevDeck can read config, run multiple services, and capture logs.

### Includes

- config loading
- CLI commands
- process runner
- prefixed terminal logs
- clean shutdown

### Excludes

- dashboard
- realtime server
- advanced parsing
- export

### Success Criteria

DevDeck can replace manually opening multiple terminals, even before the dashboard exists.

---

## Milestone 2 — Live Dashboard Prototype

### Goal

Prove DevDeck can stream logs into a browser dashboard.

### Includes

- local server
- realtime connection
- dashboard shell
- service sidebar
- unified log stream
- live updates

### Excludes

- heavy polish
- browser console capture
- production logging
- persistence

### Success Criteria

The user can see logs from multiple running services in one browser view.

---

## Milestone 3 — Useful Debugging MVP

### Goal

Make DevDeck meaningfully better than terminal tabs.

### Includes

- error/warning highlighting
- service filtering
- text search
- health checks
- copy debug context
- export current session
- restart service if feasible

### Success Criteria

The user can identify and capture an error faster than they could from scattered terminals.

---

## Milestone 4 — Public Demo Release

### Goal

Make the project shareable.

### Includes

- polished UI
- polished README
- demo project
- demo GIF/video
- known limitations
- contribution guide

### Success Criteria

A developer understands the value within 30 seconds of opening the GitHub repo.

---

# 6. Testing Plan

## 6.1 Manual Testing Scenarios

Test DevDeck with projects containing:

- one frontend service
- frontend + backend
- frontend + backend + worker
- service that exits immediately
- invalid command
- missing working directory
- port already in use
- noisy logs
- long-running service
- service with no port
- service with delayed startup

---

## 6.2 Dashboard Testing Scenarios

Test dashboard behavior for:

- live logs
- no logs yet
- service crash
- service restart
- active filters
- large log stream
- disconnected server
- export success
- export failure
- copy debug context

---

## 6.3 Cross-Platform Testing

Minimum testing:

- macOS
- Linux

Windows should be tested if MVP claims Windows support.

If not fully supported, document limitations clearly.

---

# 7. Scope Control

## 7.1 Do Not Build Before MVP

Do not build these before the MVP loop is strong:

- browser console capture
- Chrome DevTools Protocol integration
- cloud sync
- user accounts
- team workspaces
- production log agents
- long-term storage
- alerting
- metrics dashboards
- tracing
- plugin system
- Kubernetes support
- Docker Compose deep integration
- AI root-cause diagnosis

These can be roadmap items, not MVP blockers.

---

## 7.2 Allowed Future-Proofing

It is acceptable to leave conceptual room for:

- future browser log adapters
- future Docker adapters
- future local persistence
- future AI debug bundles
- future plugin-like extension points

But do not implement these systems too early.

Build the core product first.

---

# 8. Agent/Codex Implementation Guidance

If an AI coding agent is used to implement DevDeck, it should follow these rules:

1. build incrementally by phase
2. keep commits small and testable
3. avoid inventing large abstractions early
4. avoid building future-scope features unless requested
5. preserve raw logs as the source of truth
6. prefer readable code over clever internals
7. keep config simple
8. make CLI errors human-friendly
9. test with the example project after every major change
10. update docs when behavior changes

The agent should not turn DevDeck into an enterprise observability tool.

The product must remain local-first and MVP-focused.

---

# 9. MVP Definition of Done

The overall MVP is done when:

## Runtime

- DevDeck can start multiple configured local services
- DevDeck captures stdout and stderr from each service
- DevDeck tracks service status
- DevDeck handles common service failures
- DevDeck can stop services cleanly in common cases

## Dashboard

- DevDeck serves a local dashboard
- dashboard shows all services
- dashboard streams live logs
- dashboard supports unified and service-specific views
- dashboard highlights errors and warnings
- dashboard supports search and filters

## Debugging

- user can copy debug context
- user can export current session logs
- user can identify failed services quickly
- user can open configured local URLs

## Product Experience

- first-time setup is understandable
- daily run command is simple
- README is clear
- demo project works
- known limitations are documented
- the product feels useful enough to run again

---

# 10. Suggested First Public Version

The first public version should be positioned as:

```txt
DevDeck Preview
```

or:

```txt
DevDeck MVP
```

Avoid pretending it is production-grade too early.

The release should clearly say:

- local-first
- current-session only
- no cloud
- no persistent storage by default
- browser console capture planned later
- Docker support planned later

This honesty will build trust with developers.

---

# 11. Final Build Statement

The first version of DevDeck should not try to be the most powerful logging tool.

It should try to be the devtool people actually keep open while coding.

The build succeeds if the product reaches this moment:

```bash
npx devdeck dev
```

The dashboard opens.

Frontend, backend, and worker logs appear in one place.

An error happens.

The right service lights up.

The developer finds the issue faster.

That is the MVP.

