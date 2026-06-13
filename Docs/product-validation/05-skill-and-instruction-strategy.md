# Skill and Instruction Strategy

## Why CLI behavior alone is insufficient

A compact CLI does not matter if the agent still behaves like a manual shell operator.

The live-agent result already showed the main risk: DevDeck can print smaller individual outputs and still lose overall because the agent runs more commands, re-checks state too often, or drops back into raw shell behavior. The product therefore includes the behavior-shaping layer, not just the binary.

## Why instruction files are part of the product

For an agent-first tool, instructions are part of the runtime protocol:

- they tell the agent when DevDeck should be the first control plane
- they bound when raw shell fallback is acceptable
- they reduce command-search churn
- they can materially change token use, tool calls, and task success

If DevDeck requires stricter instructions to win, those instructions are part of the product surface and must be evaluated as such.

## Instruction variants to test

The benchmark should compare these variants directly:

1. no DevDeck instructions
2. current `LLMs.md`
3. strict `AGENTS.md`
4. strict `AGENTS.md` plus agent-specific rules
5. strict instructions plus future DevDeck skill
6. future MCP/tool-native adapter

Each variant should run the same tasks against the same fixture with the same prompt. Only repo setup and instruction surfaces should differ.

## What each variant means

### 1. No DevDeck instructions

- repo contains `devdeck.yml`
- no extra guidance for Codex, Claude, Cursor, or similar tools
- measures whether DevDeck is discoverable and naturally preferred

### 2. Current `LLMs.md`

- current repository guidance only
- measures whether the existing soft preference language changes behavior enough

### 3. Strict `AGENTS.md`

- repo-local instructions that enforce DevDeck-first runtime behavior
- stronger rules than `LLMs.md`
- no agent-vendor tailoring beyond the file format

### 4. Strict `AGENTS.md` plus agent-specific rules

- strict shared protocol plus agent-runtime tuning
- examples: stronger wording for Codex tool discipline, bounded retries, and stop requirements

### 5. Strict instructions plus future DevDeck skill

- explicit reusable skill or protocol file that teaches the runtime loop
- tests whether a richer reusable instruction layer improves adherence

### 6. Future MCP or tool-native adapter

- direct typed tool surface rather than CLI-only orchestration
- tests whether the CLI contract itself is the bottleneck

## Generated files to support the experiment

The next implementation slices should be able to generate or maintain these instruction artifacts:

- `AGENTS.md`
- `CLAUDE.md`
- `.cursor/rules/devdeck.mdc`
- `.devdeck/agent-protocol.md`

The content should encode the same runtime loop, with only format-specific adjustments.

## Future install command

DevDeck should eventually generate strict repo instructions with:

```bash
npx devdeck agent install --strict
```

This should be treated as a product feature under evaluation, not a guaranteed keeper. It exists only if it improves measured agent behavior.

## What strict instructions should enforce

- detect `devdeck.yml` and treat the repo as DevDeck-managed
- use DevDeck before raw startup commands
- use `diagnose --agent` before raw logs
- keep runtime-management loops bounded
- stop services cleanly at the end
- record when fallback to raw shell happened

## Measurement questions

- Did the agent use DevDeck first?
- Did it avoid raw service startup?
- Did it avoid raw log dumps?
- Did it follow the bounded runtime loop?
- Did it stop services cleanly?
- Did instructions reduce tokens and tool calls?

## Success standard

Instruction work is justified only if it changes real agent behavior in the benchmark:

- lower provider-reported tokens
- fewer runtime-management tool calls
- fewer raw lifecycle commands
- equal or better task success

If instruction generation adds maintenance cost without changing those outcomes, it should be demoted or removed from the roadmap.
