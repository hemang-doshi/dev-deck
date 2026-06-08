# Implementation Roadmap

This roadmap is intentionally phased. Do not build dashboard polish before the runtime contract is reliable.

## Phase 0: Planning docs

Deliverables:

- product requirements;
- CLI v2 spec;
- config v2 spec;
- runtime architecture;
- event/log model;
- diagnostics and error taxonomy;
- security and OSS readiness;
- ADRs;
- agent instructions.

Exit criteria:

- docs reviewed;
- unresolved decisions turned into issues;
- implementation branch can begin.

## Phase 1: Runtime contract foundation

Deliverables:

- `devdeck.response.v1` envelope;
- typed error model;
- no direct `process.exit` in command modules;
- stable `--json` for status, start, stop, snapshot, logs;
- session stale detection;
- session inspect and clear-stale commands.

Exit criteria:

- CLI tests cover success/failure JSON envelopes;
- existing human commands still work;
- stale session fixture passes.

## Phase 2: Config v2 normalization

Deliverables:

- `version: 2` schema;
- v1-to-v2 normalization;
- dependency graph validation;
- health/readiness config types;
- required env validation;
- config explain and validate commands.

Exit criteria:

- v1 fixtures still pass;
- v2 fixtures pass;
- invalid config produces typed diagnostics.

## Phase 3: Supervisor reliability

Deliverables:

- process-tree tracking;
- graceful shutdown sequence;
- declared port verification;
- service action serialization;
- restart policy foundation;
- running vs ready vs degraded state model.

Exit criteria:

- stop kills child processes in fixture app;
- ports are released after stop;
- service restart is safe and deterministic.

## Phase 4: Readiness, health, and dependencies

Deliverables:

- TCP, HTTP, and command health checks;
- log, TCP, and HTTP readiness checks;
- dependency conditions: started, ready, healthy, completed_successfully;
- startup wait behavior.

Exit criteria:

- web waits for api ready;
- api waits for db healthy;
- doctor explains waiting and timeout states.

## Phase 5: Event store and log model

Deliverables:

- `devdeck.event.v1` event envelope;
- JSONL event persistence;
- structured logs;
- error block grouping;
- log query filters;
- export debug context.

Exit criteria:

- events stream as JSONL;
- logs are queryable by service/severity/tail/error;
- export includes bounded useful context.

## Phase 6: Doctor and diagnose

Deliverables:

- deterministic doctor rule engine;
- service-level diagnose;
- findings with evidence and next actions;
- common error code coverage.

Exit criteria:

- missing env, port conflict, invalid cwd, stale session, health timeout, and non-zero exit are detected with stable codes.

## Phase 7: Dashboard alignment

Deliverables:

- dashboard consumes v2 API/events;
- doctor findings panel;
- service dependency visualization;
- error block UI;
- copy agent context.

Exit criteria:

- dashboard reflects same states as CLI;
- no dashboard-only runtime state.

## Phase 8: OSS hardening

Deliverables:

- package identity resolved;
- install docs corrected;
- contribution/security docs;
- CI fixtures;
- changelog and migration guide;
- release checklist.

Exit criteria:

- clean install works from published package or documented local build;
- examples run;
- README matches actual package identity.
