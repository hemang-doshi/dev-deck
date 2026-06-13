# Getting Started with DevDeck

This guide covers the `devdeck` binary, the compatible `devdeck.yml` config, and the new agent-first command flow.

---

## Prerequisites

DevDeck requires the following installed on your machine:
- **Node.js:** version `18.x` or higher (we recommend version `20.x` or higher).
- **npm:** node package manager.

---

## 1. Installation

You can install `devdeck` globally or compile and run it locally from source.

### Local Installation in a Project (Recommended)
You can install `devdeck` directly in your software project:
```bash
npm install -D devdeck
```

### Global Installation (via npm)
```bash
npm install -g devdeck
```

### Run from Source / Clone
If you have cloned the repository and want to run it from source:
```bash
# Install root workspace dependencies
npm install

# Build all packages (CLI, Core, Config, Server, Dashboard)
npm run build
```

---

## 2. Initialize Project Configuration

Before running DevDeck, you need a configuration file named `devdeck.yml` at the root of your project.

To initialize a basic config automatically, run:
```bash
devdeck init
```
*(If running from local source, run: `node packages/cli/dist/index.js init`)*

This creates a `devdeck.yml` file with starter values:
```yaml
project: my-awesome-app
services:
  web:
    command: npm run dev
    cwd: ./frontend
    port: 3000
    group: frontend
```

---

## 3. Start the Session

You can start the session server and runner in either **foreground** (blocks the shell and streams all outputs) or **background** (detached daemon) mode.

### Foreground Mode
```bash
devdeck dev
```
*(If running from local source, run: `node packages/cli/dist/index.js dev`)*

### Background (Detached) Mode
Highly recommended for automation, scripts, and coding agents to start the stack without blocking the shell:
```bash
devdeck start
```
*(If running from local source, run: `node packages/cli/dist/index.js start`)*

Once launched, DevDeck will:
1. Spawn native process trees for all services listed in `devdeck.yml`.
2. Bind `stdout` and `stderr` into a bounded in-memory log buffer.
3. Serve the local dashboard and action endpoints on **`http://127.0.0.1:4545`** by default.
4. Write `.devdeck/session.json` so agent-facing commands can discover the active local session.

---

## 4. Basic CLI Usage

### `init`
Generates a boilerplate `devdeck.yml` config in the current directory if one does not already exist.

### `dev`
Starts the orchestration runner in the foreground.
- **Port flag:** Customize the dashboard server port (defaults to `4545`).
  ```bash
  devdeck dev --port 5000
  ```

### `start`
Starts the orchestration runner in the background as a detached process (daemon). It redirects standard outputs to `.devdeck/devdeck.log` and exits immediately once it verifies the session server is responsive.
- **Port flag:** Customize the dashboard server port (defaults to `4545`).
  ```bash
  devdeck start --port 5000
  ```

### `agent setup`
Prints a one-time agent prompt plus a starter `devdeck.yml` template.

### `status`
Returns the current session summary as concise text or JSON.

```bash
devdeck status
devdeck status --json
```

### `logs`
Returns a bounded log tail, optionally filtered by service, severity, and grep.

```bash
devdeck logs api --tail 80
devdeck logs api --severity error --grep database
devdeck logs --json
```

### `snapshot`
Prints a markdown snapshot of services and recent logs.

```bash
devdeck snapshot
devdeck snapshot --tail 120 --json
```

### `stop`
Stops the active session discovered through `.devdeck/session.json`.

```bash
devdeck stop
```

### `service`
Controls an individual service inside the active session.

```bash
devdeck service restart api
devdeck service stop worker
devdeck service start worker
```
