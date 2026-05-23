# Configuration Reference

The behavior of DevDeck is configured using a file named `devdeck.yml` situated at the root of your project directory. 

---

## File Schema

A `devdeck.yml` file must define two root properties:
1. `project`
2. `services`

```yaml
project: <string>
services:
  <service-name>:
    command: <string>
    cwd: <string>
    port: <integer>    # Optional
    group: <string>   # Optional
```

---

## Root Properties

### `project`
- **Type:** `string` (non-empty)
- **Required:** Yes
- **Description:** A unique name for your project repository. DevDeck uses this project name to isolate UI grid customizations, card positions, and card themes in the browser's `localStorage`.

### `services`
- **Type:** `object` (non-empty)
- **Required:** Yes
- **Description:** A key-value map where keys are unique service identifiers and values are service configuration objects.

---

## Service Properties

### `command`
- **Type:** `string` (non-empty)
- **Required:** Yes
- **Description:** The exact terminal command used to launch the service.
- **Example:** `npm run dev` or `python -m uvicorn api.main:app --reload`

### `cwd`
- **Type:** `string` (non-empty)
- **Required:** Yes
- **Description:** The working directory relative to the location of the `devdeck.yml` file where the command should run.
- **Validation:** DevDeck verifies that the specified path exists and is a directory. If it is invalid, an initialization error is thrown.
- **Example:** `./frontend` or `.`

### `port`
- **Type:** `integer` (positive, non-zero)
- **Required:** No
- **Description:** The TCP port on which the service listens. DevDeck regularly performs a port-based TCP health check on this port. When the port is active, the service status on the UI updates to `healthy` (green dot). If provided, clicking the service card on the dashboard will navigate to `http://localhost:<port>`.

### `group`
- **Type:** `string` (non-empty)
- **Required:** No
- **Description:** An arbitrary string used to categorize and organize services on the dashboard. Services sharing the same group can be filtered together or viewed as a grouped tab.
- **Example:** `core`, `infra`, `background-workers`

---

## Configuration Example

Below is a complete `devdeck.yml` example illustrating various configurations:

```yaml
project: my-project

services:
  # Database and local caching infra
  docker-services:
    command: docker compose up db cache
    cwd: .
    group: infrastructure

  # Node API server
  backend-api:
    command: npm run start:dev
    cwd: ./backend
    port: 4000
    group: backend

  # NextJS client web app
  frontend-client:
    command: npm run dev
    cwd: ./frontend
    port: 3000
    group: frontend

  # Celery worker consuming backend tasks
  celery-worker:
    command: celery -A tasks worker --loglevel=info
    cwd: ./backend
    group: background
```
