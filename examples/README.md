# DevDeck YAML Configuration Examples

This directory contains configuration templates for running DevDeck in various local development setups.

## Available Examples

1. **[simple-stack.yml](file:///Users/hemangdoshi/Developer/dev-deck/examples/simple-stack.yml)**
   - **Use Case:** A typical fullstack layout with a single frontend and backend API.
   - Shows basic properties like `command`, `port`, and `group`.

2. **[monorepo-setup.yml](file:///Users/hemangdoshi/Developer/dev-deck/examples/monorepo-setup.yml)**
   - **Use Case:** Multi-package monorepos (e.g. Turbo, pnpm workspaces, Yarn workspaces).
   - Demonstrates utilizing different `cwd` paths for service isolation and custom directories.

3. **[full-stack-with-infra.yml](file:///Users/hemangdoshi/Developer/dev-deck/examples/full-stack-with-infra.yml)**
   - **Use Case:** Applications that depend on third-party services (e.g. Postgres, Redis, MinIO) running in Docker containers alongside local web apps and worker scripts.

---

## Configuration Schema Reference (`devdeck.yml`)

The `devdeck.yml` file is defined at the root of your project.

### Root Properties

- **`project`** *(string, required)*: A unique name for your project (e.g., `setuai`). This is used as the workspace key to persist local storage grid configurations.
- **`services`** *(object, required)*: A map of services, where each key represents the service name and the value is a service configuration block.

### Service Configuration Properties

Each service is defined by the following keys:

| Property | Type | Required | Description |
|---|---|---|---|
| **`command`** | `string` | **Yes** | The shell command to run and monitor. |
| **`cwd`** | `string` | **Yes** | The working directory where the command is executed (relative to the `devdeck.yml` file path). |
| **`port`** | `integer` | No | A positive integer TCP port that DevDeck will monitor. Once this port becomes active, DevDeck marks the service as healthy. Clicking the service card on the dashboard will navigate to this port. |
| **`group`** | `string` | No | A categorization grouping services together under tabs or sections on the DevDeck UI cockpit dashboard. |
