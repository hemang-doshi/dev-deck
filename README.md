# ⚡️ DevDeck

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-ui)](http://makeapullrequest.com)
[![Build Status](https://img.shields.io/badge/Build-passing-success.svg)](https://github.com/devdeck/devdeck)

**DevDeck** is a local-first developer session orchestration tool designed to run multiple services, stream their logs in real-time, and inspect application state from a beautiful, snappy grid playground.

Unlike heavy container-monitoring setups or rigid terminal multiplexers, DevDeck sits directly in your local directory, spawns process trees natively, and exposes a high-fidelity static-exported React dashboard. It lets you customize, resize, recolor, and drag-and-drop terminal tiles to build the perfect dev playground.

---

## ✨ Features

- **🚀 Instant Service Orchestration:** Run and supervise a multi-service web stack with a simple local CLI commands.
- **📡 Real-Time Log Streaming:** Seamlessly streams process stdout/stderr directly into your browser via lightweight WebSockets.
- **🎨 Snappy Tile Workspace:** A fully customizable, interactive playground featuring:
  - Drag-and-drop tiles for service groups, single services, or unified streams.
  - Multi-size support (1/3 width, 1/2 width, or full width) on a premium 12-column grid.
  - 5 customizable card theme colors (Slate, Sky, Mint, Amber, Rose) with matching glow borders.
- **⚡ Fluid Animations:** Smooth entry, exit, and list reordering powered by Framer Motion.
- **📋 Single-Click Handoff:** Copy the entire session debug context (healthy/error services, status, ports, recent logs) with a single click, perfectly formatted for GitHub issues or LLM prompts.
- **💾 Local Persistence:** Custom workspace layout configurations are automatically saved to `localStorage` per project.

---

## 🚀 Quick Start

### 1. Installation

Install DevDeck globally or build it locally from the source:

```bash
# Clone the repository
git clone https://github.com/devdeck/devdeck.git
cd dev-deck

# Install dependencies and build
npm install
npm run build
```

### 2. Initialize your Project Config

Navigate to your project directory and generate a `devdeck.yml` file:

```bash
node packages/cli/dist/index.js init
```

This creates a starter `devdeck.yml` config:

```yaml
project: my-awesome-app
services:
  web:
    command: npm run dev
    cwd: ./frontend
    port: 3000
    group: frontend
```

### 3. Run DevDeck

Spawn your services and spin up the dashboard local server:

```bash
node packages/cli/dist/index.js dev
```

Your developer dashboard will be served immediately at **`http://127.0.0.1:4545`**!

---

## ⚙️ Configuration Reference

Configure all your dev stack processes inside `devdeck.yml` at the root of your repository:

```yaml
# Unique project name (used to isolate local storage layouts)
project: setuai

# List of managed services
services:
  infra:
    command: docker compose up postgres redis minio
    cwd: .
  
  backend:
    command: npm run dev
    cwd: ./setuai-backend
    port: 3001
    group: backend

  frontend:
    command: npm run dev
    cwd: ./setuai-frontend
    port: 5173
    group: frontend
```

### Supported Configuration Keys:
- `command` *(required)*: The shell command to spin up the service.
- `cwd` *(optional)*: The working directory relative to the config file (defaults to `.`).
- `port` *(optional)*: The port of the service to monitor for TCP health checks.
- `group` *(optional)*: A category grouping services together in the Dashboard.

---

## 🛠️ Architecture

DevDeck is designed to be extremely lightweight and fast. It consists of:

1. **Core & Process Runner:** Spawns native node child-processes and binds output streams (`stdout`/`stderr`) to a high-performance in-memory ring buffer (defaulting to a 1000-line capacity).
2. **WebSocket & HTTP Server:** A fast, local server hosting static assets and opening a WebSocket server to broadcast state snapshots and live log streams.
3. **Next.js Dashboard:** A statically exported front-end application built with React 19, Framer Motion, and Tailwind CSS. The CLI hosts the exported `out` directory directly, keeping bundle payloads under **1.9MB**!

---

## 🔒 Security & Privacy

DevDeck is **100% local-first**. It never sends logs, directories, or process statistics to remote servers or third-party analytical endpoints. 

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
