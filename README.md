# ⚡️ DevDeck

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)

**DevDeck** is a local-first developer session cockpit designed to run multiple services, stream their logs in real-time, and inspect application state from a beautiful, responsive grid dashboard.

Instead of managing your frontend, backend, workers, queues, and container logs across scattered terminal tabs, DevDeck runs them native process trees, buffers output in-memory, and provides a polished grid workspace to manage your local stack.

---

## ✨ Features

- **🚀 Service Orchestration:** Launch and manage a multi-service stack with a single command.
- **📡 Live Log Streams:** Real-time log broadcasting directly to your browser via lightweight WebSockets.
- **🎨 Interactive Grid Dashboard:** Custom sizing, drag-and-drop ordering, and color-coded cards (Slate, Sky, Mint, Amber, Rose) with glow borders.
- **📋 Single-Click Handoff:** Copy the entire session debug context (healthy/error services, status, ports, recent logs) perfectly formatted for GitHub issues or AI agent coding prompts.
- **🔒 Local-First:** 100% private. No external accounts, no cloud dependencies, no remote log shipping.

---

## 🚀 Quick Start

### 1. Installation
Install DevDeck globally or run from local source:
```bash
npm install -g devdeck
```

### 2. Initialize Config
Generate a starting `devdeck.yml` configuration:
```bash
devdeck init
```
This writes a starter configuration file at the root:
```yaml
project: my-awesome-app
services:
  web:
    command: npm run dev
    cwd: .
    port: 3000
    group: web
```

### 3. Run DevDeck
Launch your service orchestra and spin up the dashboard:
```bash
devdeck dev
```
Open **`http://127.0.0.1:4545`** to view your interactive dev cockpit!

---

## 📚 Documentation

For complete reference guides, architecture layout, and setup guides, please explore the [Docs/](file:///Users/hemangdoshi/Developer/dev-deck/Docs/README.md) folder:

- 🚀 [Getting Started](file:///Users/hemangdoshi/Developer/dev-deck/Docs/getting-started.md) — Detailed installation, execution, and CLI command reference.
- ⚙️ [Configuration Reference](file:///Users/hemangdoshi/Developer/dev-deck/Docs/configuration.md) — complete specifications for `devdeck.yml` property syntax.
- 🎨 [Dashboard User Guide](file:///Users/hemangdoshi/Developer/dev-deck/Docs/dashboard.md) — How to manage service states, themes, grid controls, and search filters.
- 🛠️ [Architecture & Internals](file:///Users/hemangdoshi/Developer/dev-deck/Docs/architecture.md) — package structures, circular buffers, log processing workflow.
- 🔍 [Troubleshooting & FAQs](file:///Users/hemangdoshi/Developer/dev-deck/Docs/troubleshooting.md) — Port conflicts, exit codes, zombie processes, and connection solutions.

---

## ⚖️ License

Distributed under the MIT License. See `LICENSE` for more information.
