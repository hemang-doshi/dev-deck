# HUMANs.md - Human Onboarding & Guide

Welcome to DevDeck! DevDeck is a developer control plane designed to start, manage, and monitor all development services in your project through a single interface. It is optimized for both human developer ease and agent/LLM-driven automation.

## 🚀 Getting Started

DevDeck is intended to be installed directly in your software projects (not in global downloads or system folders).

### Option 1: Install as an npm Package (Recommended)

To set up and run DevDeck in any project, install it as a devDependency:

```bash
npm install -D devdeck
```

Initialize the configuration file:

```bash
npx devdeck init
```

Start the services stack:

```bash
npx devdeck dev
# Or run in the background (detached mode)
npx devdeck start
```

### Option 2: Running from Source / Local Cloned Workspace

If you cloned this monorepo directly, build and run the CLI locally:

```bash
# From workspace root
npm install
npm run build

# Run commands using local bin
node packages/cli/dist/index.js init
node packages/cli/dist/index.js start
```

---

## 🛠 Command Reference

| Command | Description | Example |
|---|---|---|
| `devdeck init` | Creates a starter `devdeck.yml` config file | `devdeck init` |
| `devdeck dev` | Starts DevDeck in the foreground (blocks shell) | `devdeck dev --port 4545` |
| `devdeck start` | Starts DevDeck in the background (detached daemon) | `devdeck start` |
| `devdeck status` | Checks health & status of all services | `devdeck status [--json]` |
| `devdeck logs [svc]`| Queries logs for a service | `devdeck logs api --tail 50` |
| `devdeck snapshot` | Prints full service states and log snapshot | `devdeck snapshot` |
| `devdeck stop` | Stops the running DevDeck session & all services | `devdeck stop` |
| `devdeck service <action>` | Controls a specific service (`start\|stop\|restart`) | `devdeck service restart web` |

---

## ⚙️ Configuration (`devdeck.yml`)

The configuration file defines your project and the list of services to manage:

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

---

## 🩺 Diagnostic Error Codes (`DD-ERR-XXXX`)

DevDeck includes a structured error system to help you (and AI agents) quickly identify configuration and runtime issues:

| Error Code | Title | Hint / Resolution |
|---|---|---|
| `DD-ERR-0001` | Config file not found | Run `devdeck init` to create a starter config. |
| `DD-ERR-0002` | Invalid YAML syntax | Fix standard syntax issues in `devdeck.yml`. |
| `DD-ERR-0003` | Duplicate service name | Ensure all service names in `services` are unique. |
| `DD-ERR-0004` | Invalid config schema | Verify `project` and `services` map properties. |
| `DD-ERR-0005` | Missing service command | Every service must define a `command` string. |
| `DD-ERR-0006` | Missing service cwd | Every service must define a `cwd` directory. |
| `DD-ERR-0007` | cwd path does not exist | Create the directory or correct the `cwd` field. |
| `DD-ERR-0008` | Invalid service group | `group` property must be a non-empty string. |
| `DD-ERR-0009` | Invalid service port | `port` property must be a positive integer. |
| `DD-ERR-0010` | Port already in use | Kill process on that port or specify another with `--port`. |
| `DD-ERR-0011` | Service execution crashed | Run `devdeck logs <service>` to debug service output. |
| `DD-ERR-0012` | Session server unreachable | Start the session with `devdeck start` or `devdeck dev`. |
| `DD-ERR-0013` | DevDeck already running | A background session is already active (run `devdeck stop`). |
| `DD-ERR-0014` | Background startup timeout | Check background logs at `.devdeck/devdeck.log`. |
| `DD-ERR-0015` | Session startup failure | Check host permissions and environment setup. |

---

## 🖥 Local Dashboard

When DevDeck starts, it hosts a local web dashboard (defaulting to `http://127.0.0.1:4545`).
The dashboard provides a visual interface to monitor services health, view live streaming logs, restart processes, and inspect overall health.
