# Agent Instructions for DevDeck Repos

This document defines how coding agents should use DevDeck once the revamp is implemented. It can later be adapted into `.devdeck/AGENTS.md`, `.devdeck/SKILL.md`, or tool-specific instructions.

## Golden rule

If `devdeck.yml` exists, prefer DevDeck over manually starting frontend, backend, worker, database, or queue processes.

Manual shell lifecycle commands are allowed only when:

- DevDeck itself is broken;
- no DevDeck config exists;
- the user explicitly asks for manual commands;
- a DevDeck diagnostic instructs the agent to run a manual command.

## Startup protocol

1. Check status:

```bash
devdeck status --json
```

2. If no session is running:

```bash
devdeck start --json --wait 60
```

3. If startup fails:

```bash
devdeck doctor --json
```

4. If a specific service failed:

```bash
devdeck diagnose <service> --json
```

## During development

After changing code that affects a running service:

```bash
devdeck service restart <service> --json --wait 60
```

Then inspect service health and recent errors:

```bash
devdeck service logs <service> --errors --context 20 --json
```

## Debugging order

Prefer this order:

1. `devdeck doctor --json`
2. `devdeck snapshot --mode agent --json`
3. `devdeck diagnose <service> --json`
4. `devdeck service logs <service> --errors --context 20 --json`
5. Manual shell commands only if DevDeck cannot provide the needed state.

## Shutdown protocol

Use:

```bash
devdeck stop --json
```

Avoid manual `kill`, `pkill`, `lsof`, or port cleanup unless DevDeck reports a stale process it cannot clean.

## Expected agent behavior

Agents should:

- parse JSON envelopes;
- obey `nextActions` when reasonable;
- avoid requesting unbounded logs;
- avoid restarting the whole stack when one service restart is enough;
- preserve evidence from diagnostics when reporting issues to the user;
- report DevDeck runtime bugs separately from application bugs.
