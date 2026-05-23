# Getting Started with DevDeck

Welcome to DevDeck! This guide will help you install DevDeck, initialize a configuration file for your project, and start orchestrating your services in under two minutes.

---

## Prerequisites

DevDeck requires the following installed on your machine:
- **Node.js:** version `18.x` or higher (we recommend version `20.x` or higher).
- **npm:** node package manager.

---

## 1. Installation

You can install DevDeck globally or compile and run it locally from source.

### Global Installation (via npm)
```bash
npm install -g devdeck
```

### Local Development Installation
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

## 3. Run DevDeck

To start your service runner and launch the interactive local dashboard:
```bash
devdeck dev
```
*(If running from local source, run: `node packages/cli/dist/index.js dev`)*

Once launched, DevDeck will:
1. Spawns process trees natively for all services listed in `devdeck.yml`.
2. Binds their output streams (`stdout`/`stderr`) to an in-memory buffer.
3. Serves the static React dashboard locally.
4. Opens the dashboard automatically in your browser at **`http://127.0.0.1:4545`**.
5. Displays real-time live log streams and service statuses.

---

## 4. Basic CLI Usage

### `init`
Generates a boilerplate `devdeck.yml` config in the current directory if one does not already exist.

### `dev`
Starts the orchestration runner.
- **Port flag:** Customize the dashboard server port (defaults to `4545`).
  ```bash
  devdeck dev --port 5000
  ```
- **Quiet mode:** Prevents launching the browser automatically.
  ```bash
  devdeck dev --quiet
  ```
