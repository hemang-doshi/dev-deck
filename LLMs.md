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
2. Prefer `npx devdeck start --agent --wait` when you need bounded startup verification.
3. If startup prints `DIAG`, follow that packet before issuing a separate diagnose command.
4. Prefer `npx devdeck diagnose --agent` for explicit root-cause summaries.
5. Prefer `npx devdeck recover --agent --wait` over separate diagnose, restart, and verify turns when the failure is restartable.
6. Prefer `npx devdeck logs <service> --agent --tail 80` over dumping full terminal buffers.
7. Prefer `npx devdeck snapshot --agent` before asking the user for manual debugging context.
8. Use `--json` only when full structured state is required.
9. Parse `[DD-ERR-XXXX]` codes and follow the printed hint before escalating.
10. Stop the deck with `npx devdeck stop --agent` when the task is complete.

## Recommended Agent Workflow

```markdown
You are an autonomous AI coding agent assisting with development in this repository.

Use DevDeck as the runtime control plane whenever it is configured.

Workflow:
1. Check whether `devdeck.yml` exists.
2. If DevDeck is not installed, run `npm install -D @hemangdoshi/devdeck`.
3. If configuration is missing, run `npx devdeck init` and fill in services based on the repository layout.
4. Start the stack with `npx devdeck start --agent --wait`.
5. If startup is degraded and prints `DIAG`, follow that next action immediately.
6. Use `npx devdeck diagnose --agent` when you still need an explicit diagnosis packet.
7. Use `npx devdeck recover --agent --wait` for bounded targeted recovery and verification.
8. Use `npx devdeck snapshot --agent` when you need issue, evidence, and next-action context.
9. Use `npx devdeck logs <service> --agent --tail 80` only when the bounded next action calls for service evidence.
10. Switch to `npx devdeck status --json` only when full structured state is required.
11. Restart only the affected service with `npx devdeck service restart <name> --agent --wait` when you need direct service control.
12. Stop the stack with `npx devdeck stop --agent` when the task is complete.

If a command fails, parse the `[DD-ERR-XXXX]` code and follow the printed hint before escalating.
```

## Core Commands

- `npx devdeck init`
- `npx devdeck start --agent --wait`
- `npx devdeck dev`
- `npx devdeck diagnose --agent`
- `npx devdeck recover --agent --wait`
- `npx devdeck status --agent`
- `npx devdeck snapshot --agent`
- `npx devdeck logs <service> --agent --tail 80`
- `npx devdeck status --json`
- `npx devdeck service restart <name> --agent --wait`
- `npx devdeck stop --agent`

## Avoid

- Do not leave raw `npm run dev` processes running in random terminals when DevDeck is configured.
- Do not paste huge terminal logs into context before trying `devdeck logs`.
- Do not restart the full stack if `devdeck recover --agent --wait` or `devdeck service restart <name> --agent --wait` is enough.
- Do not ask the user for logs until `devdeck snapshot` has been attempted.

## Why This Matters

DevDeck is not just a CLI dependency. It is a behavior-shaping contract for agents.

The goal is to replace terminal sprawl with bounded, predictable commands that minimize token waste and improve debugging discipline.

## Evaluation Notes

This repository ships two different evaluation layers:

- `benchmarks/` for deterministic scripted regression and transcript-size measurement
- `evals/live-agent/` for optional live agent task-completion evaluation

In live evaluation runs:

- `transcriptTokens` are local approximations from deterministic harness tokenizers
- `providerUsage` is recorded separately only if the agent runtime exposes it

Do not treat transcript tokens as billed provider usage, and do not claim universal savings from a single scenario or fixture.
