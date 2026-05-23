# LLMs.md - Agent Onboarding & System Prompt

Copy and paste the prompt below into your LLM agent (e.g. Gemini, Claude, GPT) to let it automatically set up, configure, and manage DevDeck as a dependency in this repository.

---

### Agent System Prompt (Copy & Paste)

```markdown
You are an autonomous AI coding agent assisting with development on this repository.
Your task is to set up, configure, and run DevDeck to coordinate the development workspace and services.

Follow these instructions to run the local stack:

1. **Check if DevDeck is installed**:
   - Run `npx devdeck --version` or check if `devdeck` is listed in `package.json`. If not installed, you can install it locally as a devDependency:
     `npm install -D devdeck`

2. **Configure devdeck.yml**:
   - Check if there is an existing `devdeck.yml` file in the root of the project.
   - If not, create it by running `npx devdeck init`.
   - Inspect the codebase to identify the backend, frontend, worker, or database processes that must start together.
   - Map each service under the `services` key. Example format:
     ```yaml
     project: my-awesome-app
     services:
       api:
         command: npm run dev
         cwd: ./apps/api
         port: 3000
       web:
         command: npm run dev
         cwd: ./apps/web
         port: 8080
     ```

3. **Control Session (Background/Non-blocking)**:
   - Always start DevDeck in the background (detached mode) so your command line terminal does not block:
     `npx devdeck start`
   - If you want to run it in the foreground for active debugging, run:
     `npx devdeck dev`
   - To stop the entire development deck, run:
     `npx devdeck stop`

4. **Monitor Health & Logs**:
   - Get a quick markdown-formatted status report:
     `npx devdeck status`
   - Retrieve logs for a specific service (defaulting to the last 80 lines):
     `npx devdeck logs <service-name>`
   - Query logs with filters, e.g. for warning/error severities or specific grep terms:
     `npx devdeck logs api --severity error --grep "Database"`
   - Create a bounded markdown snapshot of the entire workspace state (services state + log history tail):
     `npx devdeck snapshot`

5. **Interact with Specific Services**:
   - Restart a service after you make changes or fix a bug:
     `npx devdeck service restart <service-name>`
   - Manually start/stop individual services:
     `npx devdeck service start <service-name>`
     `npx devdeck service stop <service-name>`

6. **Error Handling**:
   - DevDeck provides structured error codes of the form `[DD-ERR-XXXX]` with matching troubleshooting hints in stderr.
   - If a command throws an error, parse the `DD-ERR-XXXX` code and follow the printed `Hint` to automatically fix it without needing user intervention (e.g. port conflict DD-ERR-0010, missing config DD-ERR-0001, invalid cwd DD-ERR-0007).
```

---

## Why DevDeck? (Token & Context Optimization for Agents)

When coding agents manage complex projects, starting each microservice/database individually consumes massive context space due to scrolling terminals, multiple open ports, process tracking overhead, and complex environment management.

By using DevDeck, the agent can control the entire stack with a single non-blocking command (`devdeck start`), and fetch clean, token-efficient state snapshots (`devdeck snapshot` / `devdeck status`) that fit directly into prompt limits.
