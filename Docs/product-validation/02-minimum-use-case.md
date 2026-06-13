# Minimum Use Case

## Exact scenario

The minimum use case is a real coding agent entering a complex repository and completing this runtime loop:

1. start the full application stack
2. verify that the stack is healthy enough to work on
3. diagnose a runtime issue affecting one service or dependency
4. recover the affected service without unnecessary full-stack churn
5. stop everything cleanly

The scenario must involve a realistic multi-service app, not a toy API plus one worker.

## Manual baseline behavior

In the manual baseline, the agent manages the stack through raw shell commands and generic repo inspection:

- discovers service commands from package scripts, Docker files, repo docs, or prior shell output
- starts services with `npm`, `pnpm`, `docker compose`, or equivalent raw commands
- verifies health by checking ports, HTTP endpoints, terminal output, and process lists
- diagnoses failures by reading logs, repeating status checks, and reasoning over raw shell evidence
- restarts or kills the affected service manually
- stops or cleans up the stack with raw stop commands, process kills, or port checks

This is the baseline DevDeck must beat.

## DevDeck expected behavior

In the DevDeck mode, the agent should treat DevDeck as the first runtime control plane when `devdeck.yml` exists and complete the same lifecycle using bounded commands before using raw shell fallback.

The agent should need fewer runtime-management decisions because DevDeck should provide:

- one bounded startup entrypoint
- compact session state
- deterministic diagnosis
- targeted recovery for one service
- reliable stack shutdown

## Required DevDeck flow

The validation target flow is:

```bash
npx devdeck start --agent --wait
npx devdeck status --agent
npx devdeck diagnose --agent
npx devdeck service restart <service> --agent --wait
npx devdeck stop --agent
```

`diagnose --agent`, `start --agent --wait`, and `service restart --agent --wait` are validation-driven target behaviors even if they do not yet exist in the current CLI.

## Required behavior details

The minimum use case is only satisfied if the agent can follow a bounded loop like this:

1. detect DevDeck management from `devdeck.yml`
2. run `npx devdeck start --agent --wait`
3. run `npx devdeck status --agent` to confirm readiness and identify degraded services
4. if unhealthy, run `npx devdeck diagnose --agent`
5. apply the recommended recovery action, preferably `npx devdeck service restart <service> --agent --wait`
6. verify recovery through `npx devdeck status --agent`
7. stop the stack with `npx devdeck stop --agent`

## Success criteria

- the agent completes the runtime loop without first starting services manually
- the agent reaches healthy state or clear deterministic failure with fewer runtime-management tool calls than the manual baseline
- the agent identifies the right failing service or dependency
- the agent applies a targeted recovery rather than full-stack restart when appropriate
- the agent stops the stack cleanly at the end
- provider-reported tokens and runtime-management tool calls are lower than the manual baseline for the same task prompt

## Failure criteria

- the agent starts raw services before DevDeck
- the agent must inspect raw long-running logs before DevDeck gives a useful diagnosis
- the agent needs repeated shell probing to understand stack state
- the agent restarts the entire stack because targeted recovery is not supported or not trusted
- the agent leaves orphaned processes or ports occupied
- the DevDeck path uses more provider-reported tokens or more runtime-management tool calls than manual orchestration without a compensating success gain

## What to measure

- provider-reported total tokens
- prompt tokens
- output tokens
- tool observation tokens
- total tool calls
- runtime-management tool calls
- raw shell commands used
- raw log tokens observed
- time to healthy state
- time to root cause
- time to recovery
- final success or failure
- root cause accuracy
- whether services were stopped cleanly
- orphaned processes or ports left behind
