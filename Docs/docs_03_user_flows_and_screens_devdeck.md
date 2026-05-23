# DevDeck — User Flows and Screens

**File:** `/docs/03-user-flows-and-screens.md`  
**Product:** DevDeck  
**Scope Level:** MVP UX Definition  
**Goal:** Define the primary user journeys and dashboard screens for the first version of DevDeck.

---

## 1. UX Summary

DevDeck should feel like a calm local control room for a developer's project.

The user should not feel like they are using an enterprise monitoring product. They should feel like they opened a clean, focused workspace that understands their local development setup.

The core UX promise is:

> One command starts your local stack. One dashboard shows what is running, what is noisy, and what broke.

The MVP experience should be fast, obvious, and visually high-signal.

---

## 2. Primary User Flows

The MVP should support four primary flows:

1. First-time setup
2. Daily development session
3. Error investigation
4. Session shutdown/export

These flows cover the most important repeated behaviors.

---

## 3. Flow 1 — First-Time Setup

### 3.1 User Goal

The user wants to configure DevDeck for an existing project.

They already have local commands like:

```bash
npm run dev
npm run api
python worker.py
```

They want DevDeck to run these together and show the logs in one dashboard.

---

### 3.2 Entry Point

The user runs:

```bash
npx devdeck init
```

or installs DevDeck and runs the equivalent local command.

---

### 3.3 Expected Experience

DevDeck should help the user create a simple project config.

The first setup should feel lightweight, not like setting up infrastructure.

The user should be guided through:

- project name
- service names
- commands for each service
- optional working directories
- optional ports

The generated config should be easy to read and edit manually.

---

### 3.4 Success State

The user ends with a DevDeck config file in the project.

They understand that the next step is:

```bash
npx devdeck dev
```

---

### 3.5 Failure States

Possible failures:

- config file already exists
- project directory is not writable
- user exits setup early
- invalid command input

DevDeck should respond with clear, non-scary messages and suggest the next manual step.

---

## 4. Flow 2 — Daily Development Session

### 4.1 User Goal

The user wants to start working on their project.

Instead of opening multiple terminals, they run one command and expect their full local stack to start.

---

### 4.2 Entry Point

The user runs:

```bash
npx devdeck dev
```

---

### 4.3 Expected CLI Experience

The CLI should:

1. read the project config
2. start the configured services
3. show a short startup summary
4. start the local dashboard server
5. open or display the dashboard URL

The CLI should avoid becoming the main interface. Its job is to start the session and provide basic fallback visibility.

Example CLI feeling:

```txt
DevDeck started 3 services
Dashboard: http://localhost:4545

web      starting   npm run dev
api      starting   npm run api
worker   starting   python worker.py
```

---

### 4.4 Expected Dashboard Experience

The dashboard opens and shows:

- service overview
- live logs
- unified stream
- current status of each service
- errors and warnings as they appear

The user should be able to glance at the dashboard and understand:

- which services are running
- whether anything failed
- where logs are coming from
- whether a configured port is reachable

---

### 4.5 Success State

All services start successfully.

The dashboard shows a healthy local development session.

The user can keep coding while DevDeck stays open as a live companion.

---

### 4.6 Partial Success State

Some services start while others fail.

DevDeck should not treat this as a total failure.

The dashboard should clearly show:

- which services are running
- which services failed
- relevant failure logs
- restart action for failed services

This is important because local stacks often fail partially.

---

### 4.7 Failure State

DevDeck cannot start the session.

Possible causes:

- config missing
- malformed config
- dashboard port unavailable
- command runner failure
- incompatible environment

DevDeck should explain the problem and provide a practical next step.

The message should be direct and useful, not cryptic.

---

## 5. Flow 3 — Error Investigation

### 5.1 User Goal

Something broke, and the user wants to quickly understand where and why.

The user is not trying to perform deep log analytics. They want to identify the failing service and collect enough context to debug.

---

### 5.2 Entry Points

The user may notice an issue from:

- a red service indicator
- an error badge
- a failed port health check
- a crashed service
- repeated warning count
- a failed request in the frontend
- a stack trace in the logs

---

### 5.3 Expected Investigation Path

The ideal path:

1. user sees visual error state
2. user clicks the affected service
3. dashboard filters to that service's logs
4. user sees recent errors and surrounding context
5. user searches or filters if needed
6. user copies debug context
7. user fixes the bug or shares the context

---

### 5.4 Debugging UX Requirements

The dashboard should make errors obvious without overwhelming the user.

Helpful UX behaviors:

- error lines are visually distinct
- warning lines are visible but less aggressive than errors
- stack traces are grouped or visually connected
- service names remain visible in unified view
- recent error count is shown near each service
- search is fast and easy to clear
- filters are obvious and reversible
- copy actions are close to the relevant logs

---

### 5.5 Copy Debug Context Flow

The user clicks:

```txt
Copy Debug Context
```

DevDeck copies a compact bundle of useful information.

This should include enough context to paste into:

- ChatGPT
- Codex
- Claude
- GitHub issue
- Slack message
- personal debugging notes

The copied context should be readable by a human.

It should not be a giant raw dump unless the user explicitly chooses export.

---

### 5.6 Success State

The user can answer:

- which service failed?
- what was the error?
- what happened immediately before it?
- is the service still running?
- what should I paste into my debugging tool?

If DevDeck helps answer these faster than terminal tabs, the flow succeeds.

---

## 6. Flow 4 — Session Shutdown and Export

### 6.1 User Goal

The user wants to stop the local development session or save logs before closing.

---

### 6.2 Shutdown Experience

The user should be able to stop the session from:

- the CLI
- the dashboard
- normal terminal interruption

DevDeck should attempt to stop all child services cleanly.

The user should not be left with zombie processes running in the background.

---

### 6.3 Export Experience

The user may export the current session logs before closing.

The export should be useful for:

- attaching to issues
- reviewing later
- sharing with teammates
- saving a failed run

The export flow should feel optional.

DevDeck should not store logs permanently unless the user explicitly chooses to export.

---

### 6.4 Success State

All services stop cleanly.

The dashboard session ends gracefully.

If the user exported logs, they know where the file was saved.

---

## 7. MVP Screens

The MVP dashboard should be composed of a few focused screens or views.

It should not feel like a large application with many pages.

Recommended MVP structure:

1. Session Dashboard
2. Service Detail View
3. Search/Filter State
4. Empty/Setup State
5. Error/Failure State
6. Export/Copy Feedback State

---

## 8. Screen 1 — Session Dashboard

### 8.1 Purpose

This is the main screen of DevDeck.

It should answer:

> What is happening across my local stack right now?

---

### 8.2 Layout

Recommended layout:

- left sidebar: services
- main panel: unified log stream
- top bar: project/session controls
- filter/search area: narrow visible logs
- bottom or side status area: optional session metadata

---

### 8.3 Key Elements

The Session Dashboard should show:

- project name
- session status
- dashboard URL if relevant
- service list
- live unified log stream
- search input
- severity filters
- service filters
- clear logs action
- copy debug context action
- export action
- stop session action

---

### 8.4 Service Sidebar Behavior

Each service item should show:

- name
- running state
- health state if applicable
- optional port
- error count
- warning count
- last activity indicator

The sidebar should make service health scannable.

A developer should not need to read logs to know which service deserves attention.

---

### 8.5 Unified Log Stream Behavior

The unified stream should merge logs from all services.

Each log line should clearly show:

- service origin
- message
- severity if detected
- time or relative time

The stream should support auto-following latest logs, with a way to pause or scroll without fighting the UI.

---

## 9. Screen 2 — Service Detail View

### 9.1 Purpose

The Service Detail View helps the user focus on one service.

It should answer:

> What is this specific service doing, and why is it failing?

---

### 9.2 Entry Point

The user clicks a service from the sidebar.

---

### 9.3 Key Elements

The view should show:

- service name
- command summary
- current status
- port/link if configured
- restart action
- stop/start action if supported
- service-specific logs
- service-specific error/warning counts
- copy service debug context action

The command summary should be helpful but not dominate the screen.

---

### 9.4 Useful States

A service can be:

- starting
- running
- healthy
- unreachable
- stopped
- crashed
- restarting

The UI should communicate these states clearly and consistently.

---

## 10. Screen 3 — Search and Filter State

### 10.1 Purpose

The user wants to narrow down noisy logs.

---

### 10.2 Supported MVP Filters

The MVP should support:

- text search
- service filter
- severity filter
- stream filter if useful, such as stdout/stderr

Advanced query syntax is not needed.

---

### 10.3 UX Requirements

Search/filtering should be:

- fast
- obvious
- reversible
- visually clear when active

The user should always know when they are viewing a filtered subset of logs.

There should be a clear way to return to the full stream.

---

## 11. Screen 4 — Empty and Setup States

### 11.1 No Config Found

If DevDeck is run without a config, the user should see a helpful message.

The message should explain:

- no DevDeck config was found
- how to create one
- the command to run next

This should feel like onboarding, not an error wall.

---

### 11.2 No Services Configured

If a config exists but has no services, the user should be guided to add one.

The UI should explain that DevDeck needs at least one local service command to stream logs.

---

### 11.3 No Logs Yet

If services are running but no logs have appeared, the dashboard should show a calm empty state.

Possible message:

```txt
Waiting for logs...
```

This prevents the dashboard from feeling broken.

---

## 12. Screen 5 — Error and Failure States

### 12.1 Service Failed to Start

The UI should show:

- service name
- failed command summary
- latest error output
- possible next action
- restart button if available

---

### 12.2 Service Crashed

The UI should show:

- crashed state
- exit code if available
- final logs before exit
- restart option
- copy debug context option

---

### 12.3 Port Unreachable

If a configured port is not reachable, DevDeck should show a warning-style state.

This should not always be treated as a crash.

Some services take time to start, and some ports may only become available after compilation.

---

### 12.4 Dashboard Server Issue

If DevDeck cannot start the dashboard server, the CLI should show a clear error.

This should include a practical suggestion, such as changing the dashboard port or checking whether another process is using it.

---

## 13. Screen 6 — Export and Copy Feedback States

### 13.1 Copy Feedback

When the user copies logs or debug context, the UI should confirm the action immediately.

Example:

```txt
Debug context copied
```

The user should not wonder whether the action worked.

---

### 13.2 Export Feedback

When the user exports logs, DevDeck should show:

- export success
- file location
- export type if relevant

If export fails, the UI should explain why in simple terms.

---

## 14. Dashboard Visual Language

DevDeck should feel like a polished local developer tool, not a corporate analytics dashboard.

Recommended visual direction:

- dark-mode-first or strong dark mode support
- clean cards
- clear service badges
- subtle status indicators
- readable monospace log area
- restrained colors
- high contrast for errors
- soft but obvious warning states
- fast interactions

The UI should feel modern, focused, and calm.

Avoid excessive charts, vanity graphs, and decorative panels that do not help debugging.

---

## 15. Information Hierarchy

The dashboard should prioritize information in this order:

1. Is the session running?
2. Which services are healthy or unhealthy?
3. What errors or warnings occurred recently?
4. What are the latest logs?
5. What can I do next?

This hierarchy should drive layout decisions.

---

## 16. Important Microinteractions

Small interactions will make DevDeck feel high-quality.

Useful MVP microinteractions:

- new log lines stream smoothly
- error count updates without jank
- service status changes are noticeable
- copied context shows confirmation
- filters show active state clearly
- clicking service instantly filters/focuses logs
- dashboard remembers whether auto-scroll is paused
- restart action shows progress

These details matter because DevDeck is a daily-use tool.

---

## 17. CLI UX Requirements

Even though the dashboard is the main interface, the CLI experience still matters.

The CLI should be:

- concise
- readable
- non-noisy
- clear about failures
- clear about dashboard URL
- safe when stopping services

The CLI should not dump unnecessary internal details unless debug mode is enabled in the future.

---

## 18. UX Anti-Goals

DevDeck should avoid:

- looking like a generic admin dashboard
- forcing users through many setup screens
- hiding raw logs behind too much abstraction
- adding complex graphs too early
- requiring users to learn observability language
- making the terminal experience worse
- overwhelming users with configuration options
- pretending to diagnose bugs automatically in the MVP

---

## 19. Demo UX Flow

The MVP demo should show a complete story:

1. developer runs DevDeck
2. frontend, backend, and worker start
3. dashboard opens
4. services show as running
5. frontend triggers an API call
6. backend throws an intentional error
7. API service turns red or shows error badge
8. user clicks the API service
9. relevant logs are visible
10. user copies debug context
11. copied context is pasted somewhere useful

This demo should make the value obvious within 30 seconds.

---

## 20. UX Success Criteria

The UX is successful if:

- the user understands the dashboard without explanation
- service status is visible at a glance
- errors are harder to miss than in terminal tabs
- filtering logs feels faster than switching terminals
- copy debug context feels genuinely useful
- the dashboard is pleasant enough to keep open while coding
- the tool feels lightweight, not enterprise-heavy

The strongest validation is simple:

> A developer chooses to run DevDeck again tomorrow.

