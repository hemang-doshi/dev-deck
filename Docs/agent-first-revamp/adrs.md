# Architectural Decision Records

These decisions should be treated as hard-to-change once implementation begins.

## ADR 0001: Agent-first runtime identity

Decision: DevDeck v2 is an agent-native local runtime supervisor, not only a dashboard or process manager.

Consequences:

- CLI JSON contracts are first-class.
- Dashboard is an inspector, not the source of truth.
- Diagnostics and bounded snapshots matter more than visual polish during the revamp.

## ADR 0002: Versioned config schema

Decision: `devdeck.yml` v2 requires `version: 2`; unversioned configs are normalized as v1 compatibility.

Consequences:

- Future breaking schema changes can be handled cleanly.
- Config validation must produce typed diagnostics.
- Documentation must show both minimum and full examples.

## ADR 0003: Stable JSON response envelope

Decision: All `--json` commands return `devdeck.response.v1`.

Consequences:

- Agents can parse results consistently.
- Errors, summaries, and next actions become predictable.
- Human formatting cannot leak into JSON output.

## ADR 0004: JSONL for streaming events and logs

Decision: Streaming logs/events use newline-delimited JSON.

Consequences:

- Agents can consume events incrementally.
- Shell pipelines remain possible.
- No ANSI, banners, or progress text in JSONL mode.

## ADR 0005: Process-tree supervision

Decision: `devdeck stop` must stop process trees, not only direct child processes.

Consequences:

- Runtime needs process group tracking or platform-specific tree kill logic.
- Stop behavior must be tested on supported platforms.
- Declared ports should be verified after shutdown.

## ADR 0006: Readiness is not health

Decision: DevDeck distinguishes process running, readiness, and ongoing health.

Consequences:

- Dependencies wait on explicit conditions.
- A service can be running but not ready.
- A service can become degraded after being ready.

## ADR 0007: Deterministic diagnostics before AI diagnosis

Decision: Doctor/diagnose are deterministic rule engines first.

Consequences:

- DevDeck does not require model access to explain its own state.
- Findings must include evidence and next actions.
- AI-powered diagnosis, if added later, is an optional layer on top.

## ADR 0008: Local-only security by default

Decision: The API server binds to localhost and remote control is disabled by default.

Consequences:

- Remote agent scenarios require explicit opt-in.
- Dashboard/API actions should not assume public network exposure.
- Secret redaction is part of core runtime behavior.

## ADR 0009: One runtime API for CLI and dashboard

Decision: CLI, dashboard, and future adapters consume the same runtime/session model.

Consequences:

- No duplicate dashboard-only state logic.
- Bugs are fixed once in the runtime layer.
- Agent and human views stay consistent.

## ADR 0010: Backward compatibility through normalization

Decision: Existing simple configs remain supported by normalizing them into v2 internally.

Consequences:

- Users can migrate gradually.
- Tests must cover v1 and v2 configs.
- Docs should still encourage v2 for new projects.
