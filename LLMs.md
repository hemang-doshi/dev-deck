# LLMs.md - Agent Integration Guide

This file defines how coding agents should behave when operating in a repository that uses DevDeck.

## Install

If DevDeck is not already present in `package.json`, install the published CLI package:

```bash
npm install -D @hemangdoshi/devdeck
```

The package exposes the `devdeck` binary, so run commands with `npx devdeck`.

## Agent Contract

When working in a repository using DevDeck:

1. Prefer `npx devdeck start` over long-running raw service commands.
2. Prefer `npx devdeck status --agent` for compact diagnosis-oriented state.
3. Prefer `npx devdeck logs <service> --agent --tail 80` over dumping full terminal buffers.
4. Prefer `npx devdeck snapshot --agent` before asking the user for manual debugging context.
5. Use `--json` only when full structured state is required.
6. Parse `[DD-ERR-XXXX]` codes and follow the printed hint before escalating.
7. Stop the deck with `npx devdeck stop` when the task is complete.

## Recommended Agent Workflow

```markdown
You are an autonomous AI coding agent assisting with development in this repository.

Use DevDeck as the runtime control plane whenever it is configured.

Workflow:
1. Check whether `devdeck.yml` exists.
2. If DevDeck is not installed, run `npm install -D @hemangdoshi/devdeck`.
3. If configuration is missing, run `npx devdeck init` and fill in services based on the repository layout.
4. Start the stack with `npx devdeck start`.
5. Use `npx devdeck status --agent` to inspect compact state first.
6. Use `npx devdeck snapshot --agent` when you need issue, evidence, and next-action context.
7. Use `npx devdeck logs <service> --agent --tail 80` for bounded debugging context.
8. Switch to `npx devdeck status --json` only when full structured state is required.
9. Restart only the affected service with `npx devdeck service restart <name>` when possible.
10. Stop the stack with `npx devdeck stop` when the task is complete.

If a command fails, parse the `[DD-ERR-XXXX]` code and follow the printed hint before escalating.
```

## Core Commands

- `npx devdeck init`
- `npx devdeck start`
- `npx devdeck dev`
- `npx devdeck status --agent`
- `npx devdeck snapshot --agent`
- `npx devdeck logs <service> --agent --tail 80`
- `npx devdeck status --json`
- `npx devdeck service restart <name>`
- `npx devdeck stop`

## Avoid

- Do not leave raw `npm run dev` processes running in random terminals when DevDeck is configured.
- Do not paste huge terminal logs into context before trying `devdeck logs`.
- Do not restart the full stack if `devdeck service restart <name>` is enough.
- Do not ask the user for logs until `devdeck snapshot` has been attempted.

## Why This Matters

DevDeck is not just a CLI dependency. It is a behavior-shaping contract for agents.

The goal is to replace terminal sprawl with bounded, predictable commands that minimize token waste and improve debugging discipline.

## Evaluation Notes

This repository ships two different evaluation layers:

- `benchmarks/` for deterministic scripted regression and transcript-size measurement
- `evals/live-agent/` for optional live agent task-completion evaluation

In live evaluation runs:

- `transcriptTokens` are local approximations using `tiktoken-o200k_base`
- `providerUsage` is recorded separately only if the agent runtime exposes it

Do not treat transcript tokens as billed provider usage, and do not claim universal savings from a single scenario or fixture.
