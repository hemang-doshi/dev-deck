# <img src="assets/icon.png" width="48" height="48" valign="middle" /> Agent DevDeck

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)

**Agent DevDeck** is a local-first development control plane for starting, stopping, inspecting, and debugging multi-service local stacks. It features a bounded CLI and web dashboard, designed from the ground up to be **agent-first** (easy for AI coding agents to control with minimum token overhead) and **human-friendly**.

---

## Features

- **Agent-First Design:** Easy non-blocking background running via `devdeck start` and token-efficient state snapshots via `devdeck snapshot`.
- **Diagnostic Error System:** Built-in error numbering (`[DD-ERR-XXXX]`) and stderr hints for rapid self-healing by AI agents and humans alike.
- **Service Orchestration:** Launch and manage a multi-service stack with a single `devdeck.yml` config file.
- **Live Web Dashboard:** Stream logs and control processes in a clean web UI.
- **Zero Hoisting/Self-Contained:** Published as a single, compiled npm package containing all logic and dashboard assets for fast setup.

---

## 🚀 Quick Start

### 1. Installation

Install DevDeck directly in your software projects:

```bash
npm install -D devdeck
```

### 2. Initialize Config

Generate a starting `devdeck.yml` configuration:

```bash
npx devdeck init
```

Example config:

```yaml
project: my-awesome-app
services:
  web:
    command: npm run dev
    cwd: ./frontend
    port: 3000
    group: frontend
  api:
    command: npm start
    cwd: ./backend
    port: 8080
    group: backend
```

### 3. Start DevDeck

To start in the foreground (blocks shell, displays logs):

```bash
npx devdeck dev
```

To start in the background (detached daemon mode, ideal for AI agents and automation):

```bash
npx devdeck start
```

### 4. Monitor & Control

Once running, use the bounded CLI commands:

- **Check status:** `npx devdeck status`
- **Query logs:** `npx devdeck logs api --tail 50`
- **Check health snapshot:** `npx devdeck snapshot`
- **Restart service:** `npx devdeck service restart api`
- **Stop everything:** `npx devdeck stop`

Open **`http://127.0.0.1:4545`** to view the live local web dashboard.

---

## 📖 Guides & Onboarding

- **[LLMs.md](LLMs.md)**: Agent-first onboarding prompt and instructions. Copy-paste directly into your agent to let it configure and control DevDeck.
- **[HUMANs.md](HUMANs.md)**: Human developer onboarding, command lists, and custom setup guide.
- **[Docs/](Docs/README.md)**: Full reference manual covering configuration schemas, architecture, and advanced options.

---

## ⚖️ License

Distributed under the MIT License. See `LICENSE` for more information.
