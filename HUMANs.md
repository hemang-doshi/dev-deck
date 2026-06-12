# HUMANs.md - Human Onboarding & Guide

DevDeck is your local development deck: one place to start, inspect, debug, restart, and stop the processes that make up your application.

## Mental Model

DevDeck is your local development deck.

Instead of keeping separate terminals open for your frontend, backend, workers, queues, and supporting services, you define them once in `devdeck.yml`.

Then DevDeck gives both humans and coding agents one place to:

- start the stack
- check service state
- inspect bounded logs
- restart individual services
- create a compact debug snapshot
- stop everything cleanly

## Getting Started

Install the published CLI package in your project:

```bash
npm install -D @hemangdoshi/devdeck
```

Initialize the configuration:

```bash
npx devdeck init
```

Start the deck:

```bash
npx devdeck dev
# or run in the background
npx devdeck start
```

## When Should I Use This?

Use DevDeck when your project has more than one local process:

- frontend + backend
- API + worker
- app + database
- monorepo services
- queues, cron jobs, websocket servers, background jobs

DevDeck is especially useful when an AI coding agent is helping you because it gives the agent compact commands instead of noisy terminal output.

## Running from Source

If you are working directly in this monorepo, build and run the CLI from source:

```bash
npm install
npm run build
node packages/cli/dist/index.js init
node packages/cli/dist/index.js start
```

## Command Reference

| Command | Description | Example |
|---|---|---|
| `devdeck init` | Create a starter `devdeck.yml` | `devdeck init` |
| `devdeck dev` | Start DevDeck in the foreground | `devdeck dev --port 4545` |
| `devdeck start` | Start DevDeck in the background | `devdeck start` |
| `devdeck status` | Check health and status of all services | `devdeck status --json` |
| `devdeck logs [service]` | Query bounded logs for a service | `devdeck logs api --tail 50` |
| `devdeck snapshot` | Print a compact deck snapshot | `devdeck snapshot` |
| `devdeck stop` | Stop the current DevDeck session | `devdeck stop` |
| `devdeck service <action>` | Start, stop, or restart one service | `devdeck service restart web` |

## Configuration (`devdeck.yml`)

```yaml
project: my-microservices-app
services:
  database:
    command: docker-compose up db
    cwd: ./db
    port: 5432
  api:
    command: npm run start
    cwd: ./services/api
    port: 3000
    group: backend
  frontend:
    command: npm run dev
    cwd: ./apps/frontend
    port: 5173
    group: frontend
```

## Diagnostic Error Codes

DevDeck includes structured `DD-ERR-XXXX` error codes so humans and agents can recover from common problems quickly.

| Error Code | Title | Hint / Resolution |
|---|---|---|
| `DD-ERR-0001` | Config file not found | Run `devdeck init` to create a starter config. |
| `DD-ERR-0002` | Invalid YAML syntax | Fix syntax issues in `devdeck.yml`. |
| `DD-ERR-0003` | Duplicate service name | Ensure all service names in `services` are unique. |
| `DD-ERR-0004` | Invalid config schema | Verify `project` and `services` map properties. |
| `DD-ERR-0005` | Missing service command | Every service must define a `command` string. |
| `DD-ERR-0006` | Missing service cwd | Every service must define a `cwd` directory. |
| `DD-ERR-0007` | cwd path does not exist | Create the directory or correct the `cwd` field. |
| `DD-ERR-0008` | Invalid service group | `group` must be a non-empty string. |
| `DD-ERR-0009` | Invalid service port | `port` must be a positive integer. |
| `DD-ERR-0010` | Port already in use | Free the port or specify another with `--port`. |
| `DD-ERR-0011` | Service execution crashed | Run `devdeck logs <service>` to inspect output. |
| `DD-ERR-0012` | Session server unreachable | Start the session with `devdeck start` or `devdeck dev`. |
| `DD-ERR-0013` | DevDeck already running | Stop the active session with `devdeck stop`. |
| `DD-ERR-0014` | Background startup timeout | Check background logs at `.devdeck/devdeck.log`. |
| `DD-ERR-0015` | Session startup failure | Check host permissions and environment setup. |

## Local Dashboard

When DevDeck starts, it hosts a local dashboard at `http://127.0.0.1:4545` by default.

Use it to monitor services, inspect logs, restart processes, and understand the current state of the deck without juggling extra terminals.
