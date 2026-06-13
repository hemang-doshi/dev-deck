# Agent Behavior Protocol

## Purpose

This document defines the runtime behavior contract to test whether DevDeck can materially change what a coding agent does in a DevDeck-managed repository.

It is intentionally stricter than the current `LLMs.md` because the benchmark is evaluating a product thesis, not just recommending a tool.

## Detection rule

If `devdeck.yml` exists, the repository is DevDeck-managed.

## Hard rules

- Do not start services manually before DevDeck when `devdeck.yml` exists.
- Do not run raw long-running `npm run dev`, `pnpm dev`, `docker compose up`, or equivalent service commands unless DevDeck fails twice with typed errors.
- Do not inspect raw logs before `devdeck diagnose --agent`.
- Do not run more than two diagnostic commands before applying the recommended action.
- Do not restart the entire stack when a single-service recovery is the recommended action.
- Do not use dashboard inspection as the primary benchmark path.
- Always stop the stack at the end.

## Default runtime loop

When `devdeck.yml` exists, the default runtime loop is:

1. run `npx devdeck start --agent --wait`
2. run `npx devdeck status --agent`
3. if degraded or failed, run `npx devdeck diagnose --agent`
4. apply the recommended bounded action, preferably `npx devdeck service restart <service> --agent --wait`
5. re-check `npx devdeck status --agent`
6. stop with `npx devdeck stop --agent`

This loop is the default until DevDeck proves it cannot provide the required information.

## Failure loop

If DevDeck fails, the agent should stay disciplined:

1. capture the typed DevDeck error
2. retry once if the error is explicitly retryable
3. run at most one additional bounded DevDeck diagnostic command
4. apply the recommended action if one exists
5. only after two typed DevDeck failures may the agent switch to raw shell lifecycle commands

Raw shell fallback is a failure of the product path, not a normal success path.

## Token discipline

- prefer bounded `--agent` output over generic shell observation
- avoid raw log dumps unless DevDeck has already failed twice
- avoid status polling loops without a state change
- avoid redundant help reads once the protocol is known
- prefer one action followed by one verification over many small speculative probes

## Escape hatch

The escape hatch is allowed only when one of these is true:

- DevDeck returns two typed failures for the same task loop
- DevDeck reports that the required command is unsupported
- the user explicitly asks for manual shell orchestration
- the benchmark mode being executed is the manual baseline

When the escape hatch is used, the transcript should record that DevDeck failed to hold the runtime loop.

## When raw shell is allowed

Raw shell commands are allowed only for:

- baseline benchmark mode
- explicit fallback after the failure loop above
- verifying a suspected DevDeck runtime bug
- code changes unrelated to runtime lifecycle after the stack is already healthy
- final confirmation that no orphaned process remains if DevDeck stop behavior is under test

## When `devdeck --help` or docs reading is allowed

Allowed only when:

- the agent is in a cold-start repo and the required DevDeck command surface is unknown
- the repo instructions explicitly reference a command that appears unsupported
- the agent has hit a typed error that points to help or docs

Not allowed as a default first step once the benchmark protocol is established. The benchmark should measure runtime management, not command discovery churn.

## Command budget expectation

In the DevDeck path, the agent should usually stay within this bounded runtime-management loop:

- startup: `start --agent --wait`
- inspect: `status --agent`
- diagnose: `diagnose --agent`
- recover: `service restart <service> --agent --wait`
- verify: `status --agent`
- stop: `stop --agent`

If common scenarios require materially more runtime-management commands than this, the product path is too weak.

## Suitable future conversion targets

This protocol should later be converted into:

- `AGENTS.md`
- `CLAUDE.md`
- `.cursor/rules/devdeck.mdc`
- `.devdeck/agent-protocol.md`

The benchmark should evaluate whether those instruction forms meaningfully change behavior.
