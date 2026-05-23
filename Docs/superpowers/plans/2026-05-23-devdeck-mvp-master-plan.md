# DevDeck MVP Master Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-first DevDeck MVP that can initialize project config, run multiple services, stream bounded in-memory logs over a local WebSocket session server, and render a static-exported Next.js dashboard served by the DevDeck runtime.

**Architecture:** DevDeck is split into a Node CLI, a shared core/config layer, a local session server, and a statically exported Next.js dashboard. The runtime owns process control, session state, WebSockets, exports, and shutdown; the dashboard is a local UI client that consumes realtime state instead of containing orchestration logic.

**Tech Stack:** npm workspaces, TypeScript, Node.js, Next.js static export, React, Tailwind CSS, shadcn/ui, selective Magic UI, YAML config, WebSocket transport, Vitest, Playwright

---

## Assumptions And Constraints

- The current folder becomes the implementation repo.
- Existing [`Docs/`](/Users/hemangdoshi/Developer/dev-deck/Docs) files remain source specs.
- New planning artifacts live under [`docs/superpowers/plans/`](/Users/hemangdoshi/Developer/dev-deck/docs/superpowers/plans).
- macOS and Linux are the only MVP support targets.
- The user’s latest decision overrides the older Vite recommendation in [`Docs/docs_04_technical_architecture_devdeck.md`](/Users/hemangdoshi/Developer/dev-deck/Docs/docs_04_technical_architecture_devdeck.md): `apps/dashboard` uses Next.js static export.
- This is the master plan. Before coding each phase, write a short executable phase plan with task-level TDD steps if the phase has meaningful implementation breadth.

## Success Criteria

- `devdeck init` creates a readable starter `devdeck.yml`.
- `devdeck dev` discovers config, validates it, starts the session server, starts services, serves the dashboard, and shuts down cleanly.
- Service stdout/stderr is captured with service identity and bounded memory retention.
- Dashboard reconnect shows current session state and recent logs without needing persistence.
- Service start, stop, restart, and whole-session stop work reliably.
- Export produces current-session logs plus debug context on demand.
- Core flows from [`Docs/docs_03_user_flows_and_screens_devdeck.md`](/Users/hemangdoshi/Developer/dev-deck/Docs/docs_03_user_flows_and_screens_devdeck.md) are covered by automated and manual verification.

## Proposed File Structure

```txt
dev-deck/
  apps/
    dashboard/
      app/
      components/
      lib/
      public/
      tests/
  packages/
    cli/
      src/
      tests/
    config/
      src/
      tests/
    core/
      src/
      tests/
    server/
      src/
      tests/
  examples/
    fullstack-basic/
  docs/
    superpowers/
      plans/
  Docs/
```

## Shared Design Decisions

- Keep the config surface minimal: `project`, `services`, and optional service metadata only.
- Use small focused packages:
  - `config`: discovery, parsing, validation
  - `core`: session model, log buffer, log classification, process abstractions
  - `server`: HTTP, WebSocket, action routing, asset serving
  - `cli`: command entrypoints and process/session wiring
- Prefer explicit internal event shapes over premature abstractions.
- Bounded in-memory retention is per session only; no automatic persistence.
- UI polish is deferred until the runtime loop is stable.

## Phase Breakdown

### Phase 1: Foundation And Repo Setup

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `npm-workspace.yaml` or workspace config inside `package.json` (pick one, do not duplicate)
- Create: `apps/dashboard/package.json`
- Create: `packages/cli/package.json`
- Create: `packages/config/package.json`
- Create: `packages/core/package.json`
- Create: `packages/server/package.json`
- Create: `README.md`
- Create: `examples/fullstack-basic/`

- [ ] Initialize git and verify the repo starts from a clean baseline.

```bash
git init
git status --short --branch
```

Expected: repository initializes successfully and reports an empty branch with only untracked files.

- [ ] Add a minimal npm workspace root with shared scripts and TypeScript base config.

```json
{
  "name": "devdeck",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "build": "npm run build --workspaces",
    "test": "npm run test --workspaces",
    "lint": "npm run lint --workspaces"
  }
}
```

- [ ] Scaffold package boundaries only far enough to support the MVP architecture.
- [ ] Add placeholder `build`, `test`, and `lint` commands in each workspace so the repo can execute end-to-end checks immediately.
- [ ] Create an example project shell that later phases can use for integration and demo verification.
- [ ] Commit the baseline after install/build/test all run successfully.

Run:

```bash
npm install
npm run build
npm run test
```

Expected: all workspace scripts resolve successfully even if they are placeholders.

### Phase 2: Config And CLI

**Files:**
- Create: `packages/config/src/schema.ts`
- Create: `packages/config/src/load-devdeck-config.ts`
- Create: `packages/config/src/errors.ts`
- Create: `packages/config/tests/load-devdeck-config.test.ts`
- Create: `packages/cli/src/index.ts`
- Create: `packages/cli/src/commands/init.ts`
- Create: `packages/cli/src/commands/dev.ts`
- Create: `packages/cli/tests/init-command.test.ts`
- Create: `packages/cli/tests/dev-command.test.ts`

- [ ] Write failing config-loader tests for discovery, parse success, invalid YAML, missing required fields, invalid `cwd`, and duplicate service names.
- [ ] Implement the minimal config schema:

```yaml
project: my-app
services:
  web:
    command: npm run dev
    cwd: ./frontend
    port: 3000
```

- [ ] Implement `devdeck init` to create a starter file and fail clearly if `devdeck.yml` already exists.
- [ ] Implement `devdeck dev` as a parse-and-print skeleton first; do not start processes in this phase.
- [ ] Keep CLI errors readable and actionable; prefer plain text over stack traces for user faults.
- [ ] Verify with targeted tests and a manual dry run.

Run:

```bash
npm run test --workspace @devdeck/config
npm run test --workspace @devdeck/cli
node packages/cli/dist/index.js init
node packages/cli/dist/index.js dev
```

Expected: `init` creates `devdeck.yml`; `dev` prints parsed service info from config.

### Phase 3: Process Runner And Log Capture

**Files:**
- Create: `packages/core/src/process-runner.ts`
- Create: `packages/core/src/service-session.ts`
- Create: `packages/core/src/log-buffer.ts`
- Create: `packages/core/src/log-event.ts`
- Create: `packages/core/tests/process-runner.test.ts`
- Create: `packages/core/tests/log-buffer.test.ts`
- Modify: `packages/cli/src/commands/dev.ts`

- [ ] Write failing unit tests for bounded log retention, event ordering, and restart bookkeeping.
- [ ] Write integration tests that cover:
  - successful long-running process
  - immediate exit
  - invalid command
  - missing `cwd`
  - repeated restart
  - SIGINT/SIGTERM cleanup
- [ ] Implement child-process spawning with explicit service identity and stdout/stderr tagging.
- [ ] Emit session events for start, output, exit, restart, and stop.
- [ ] Add whole-session shutdown that terminates all child processes cleanly before the CLI exits.
- [ ] Keep retention bounded by line count or byte size; pick one and encode it as a tested constant, not a vague behavior.

Run:

```bash
npm run test --workspace @devdeck/core
node packages/cli/dist/index.js dev
```

Expected: configured services start, logs appear in the terminal summary path, and Ctrl+C stops children cleanly.

### Phase 4: Session Server And Realtime State

**Files:**
- Create: `packages/server/src/create-session-server.ts`
- Create: `packages/server/src/http-routes.ts`
- Create: `packages/server/src/websocket-broker.ts`
- Create: `packages/server/src/dashboard-assets.ts`
- Create: `packages/server/tests/session-server.test.ts`
- Modify: `packages/cli/src/commands/dev.ts`
- Modify: `packages/core/src/service-session.ts`

- [ ] Write failing tests for:
  - initial snapshot on connect
  - log event fanout
  - reconnect receiving current bounded state
  - action feedback for start/stop/restart
  - dashboard asset serving
- [ ] Implement a local HTTP server that serves the exported dashboard assets and lightweight action endpoints.
- [ ] Implement WebSocket messages for:
  - initial session snapshot
  - service status changes
  - log events
  - health updates
  - action acknowledgements or failures
- [ ] Keep session state in memory only; reconstruct it from runtime events instead of adding persistence.
- [ ] Update `devdeck dev` so the server owns the browser URL and runtime lifecycle.

Run:

```bash
npm run test --workspace @devdeck/server
node packages/cli/dist/index.js dev
curl http://localhost:4545/health
```

Expected: HTTP server responds locally and WebSocket clients receive a current session snapshot plus live updates.

### Phase 5: Next.js Dashboard MVP

**Files:**
- Create: `apps/dashboard/app/page.tsx`
- Create: `apps/dashboard/app/layout.tsx`
- Create: `apps/dashboard/components/service-rail.tsx`
- Create: `apps/dashboard/components/log-stream.tsx`
- Create: `apps/dashboard/components/session-header.tsx`
- Create: `apps/dashboard/lib/session-client.ts`
- Create: `apps/dashboard/tests/dashboard.spec.ts`
- Modify: `apps/dashboard/next.config.*`
- Modify: `apps/dashboard/package.json`

- [ ] Scaffold a Next.js app configured for static export only.
- [ ] Build the dashboard around the four essential states:
  - healthy session
  - partial failure
  - empty/no logs yet
  - disconnected/reconnecting
- [ ] Implement service rail, unified log stream, single-service filter, status indicators, and responsive layout.
- [ ] Use shadcn/ui for core controls and only add Magic UI where it improves signal without obscuring information.
- [ ] Make the client consume the session server over WebSocket; do not add orchestration logic to the dashboard.
- [ ] Add dashboard tests for live logs, service filter changes, empty state, crash state, and disconnect state.

Run:

```bash
npm run build --workspace @devdeck/dashboard
npm run test --workspace @devdeck/dashboard
```

Expected: Next.js exports static assets successfully and the UI renders against mocked session data.

### Phase 6: Debugging Features

**Files:**
- Create: `packages/core/src/classify-log-line.ts`
- Create: `packages/core/src/format-debug-context.ts`
- Create: `packages/core/src/export-session.ts`
- Create: `packages/core/tests/classify-log-line.test.ts`
- Create: `packages/core/tests/export-session.test.ts`
- Create: `apps/dashboard/components/log-toolbar.tsx`
- Create: `apps/dashboard/components/debug-context-panel.tsx`
- Modify: `packages/server/src/http-routes.ts`
- Modify: `apps/dashboard/lib/session-client.ts`

- [ ] Write failing tests for severity classification, URL/port detection, stack-trace grouping, debug-context formatting, and export output.
- [ ] Implement lightweight best-effort classification only; do not build framework-specific parsers.
- [ ] Add dashboard search and severity filters over current session data.
- [ ] Add copy selected logs, copy debug context, and export current session actions with clear feedback.
- [ ] Add port health checks for configured services and feed their status into the session stream.

Run:

```bash
npm run test --workspace @devdeck/core
npm run test --workspace @devdeck/dashboard
```

Expected: exports are deterministic, debug context is readable, and UI actions reflect copy/export success.

### Phase 7: Polish, Demo, And Release Prep

**Files:**
- Create: `examples/fullstack-basic/devdeck.yml`
- Create: `examples/fullstack-basic/README.md`
- Create: `docs/superpowers/specs/` if new execution artifacts are needed
- Modify: `README.md`
- Modify: package manifests and release scripts as needed

- [ ] Create a realistic demo project with frontend, backend, worker, warnings, an intentional backend error, and usable port links.
- [ ] Add README setup, known limitations, supported platforms, and current non-goals.
- [ ] Capture screenshots or GIF-ready flows after the MVP is stable.
- [ ] Verify npm packaging shape before any preview release.
- [ ] Run manual end-to-end checks on macOS and Linux before calling the MVP ready for preview.

Run:

```bash
npm pack --workspaces
npm run build
npm run test
```

Expected: workspace packages build cleanly, package tarballs are sane, and the demo flow works from `devdeck init` through shutdown/export.

## Cross-Phase Testing Strategy

- Unit tests:
  - config loading and validation
  - bounded buffers
  - log classification
  - debug context formatting
  - export formatting
- Integration tests:
  - process lifecycle
  - invalid command and missing `cwd`
  - immediate exits
  - repeated restart
  - signal shutdown
  - WebSocket session updates
- Dashboard tests:
  - live logs
  - filters
  - service controls
  - empty states
  - crash states
  - copy/export feedback
  - disconnected state
- Manual verification:
  - example project with frontend, backend, worker
  - intentional warning and error flows
  - reconnect behavior
  - port health behavior

## Risks To Watch

- Over-designing workspace/package boundaries before the runtime loop exists.
- Letting the dashboard dictate runtime contracts before process control is proven.
- Using unbounded log retention that masks memory pressure until late.
- Building UI polish before start/stop/restart and shutdown are reliable.
- Mixing older Vite assumptions into the Next.js static-export implementation path.

## Phase Exit Gates

- Phase 1 exit: repo installs, builds, and tests with workspace placeholders.
- Phase 2 exit: config round-trip and CLI ergonomics are stable.
- Phase 3 exit: process lifecycle and clean shutdown are reliable.
- Phase 4 exit: reconnectable realtime session state is stable.
- Phase 5 exit: dashboard is usable for the daily dev session flow.
- Phase 6 exit: investigation workflow is materially faster than terminals alone.
- Phase 7 exit: demo and packaging support a public preview.

## Recommended Immediate Next Step

- Write the executable Phase 1 plan first, because the repo is still pre-`git init` and has no workspace scaffold yet.

Plan complete and saved to `docs/superpowers/plans/2026-05-23-devdeck-mvp-master-plan.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
