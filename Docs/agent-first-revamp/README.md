# Agent-First Revamp Planning Pack

This folder is the planning source of truth for the DevDeck agent-first revamp. It is documentation-only and should be reviewed before runtime implementation begins.

## Phase goal

Transform DevDeck from a useful local process dashboard into an agent-native local runtime supervisor for multi-service development stacks. The human dashboard remains important, but the primary contract becomes the machine-readable control plane that AI coding agents can trust.

## Product thesis

DevDeck should provide one reliable local protocol for:

1. discovering a project's runnable services;
2. starting them with explicit dependency and readiness semantics;
3. observing state, logs, health, and failures through bounded outputs;
4. diagnosing common failure modes without forcing agents to scrape terminals;
5. stopping the whole process tree safely;
6. giving humans a dashboard for inspection and intervention.

## Reading order

1. `product-requirements.md` - product requirements, users, goals, non-goals, and acceptance criteria.
2. `cli-v2-spec.md` - CLI command surface and stable agent response envelope.
3. `config-v2-spec.md` - versioned `devdeck.yml` schema and migration rules.
4. `runtime-architecture.md` - supervisor, server, event store, dashboard, and adapter boundaries.
5. `event-log-model.md` - structured events, JSONL streaming, log storage, and query behavior.
6. `diagnostics-error-taxonomy.md` - doctor/diagnose behavior and error code model.
7. `security-oss-readiness.md` - local security model, package identity, and OSS release expectations.
8. `adrs.md` - architectural decisions that should be treated as hard-to-change.
9. `agent-instructions.md` - repository-local instructions for coding agents.
10. `implementation-roadmap.md` - proposed build phases and release gates.

## Hard constraints for the revamp

- Agent-facing commands must support stable `--json` output.
- Streamed logs/events must use newline-delimited JSON, not terminal-only formatting.
- Running, ready, healthy, exited, failed, and stopped must be distinct states.
- Dependency ordering must wait for readiness/health, not just process spawn.
- `devdeck stop` must reliably stop process trees and verify declared ports are released.
- Diagnostics must be deterministic rules first; DevDeck must not require an LLM to explain its own state.
- The dashboard must consume the same runtime API as the CLI; it must not become a separate source of truth.
- Backward compatibility with the current minimal config should be preserved through normalization.

## Out of scope for this phase

- Cloud sync.
- Team accounts.
- Remote agents.
- Plugin marketplace.
- AI-generated diagnosis.
- Fancy dashboard redesign beyond what the runtime contract requires.
- Kubernetes or multi-machine orchestration.
