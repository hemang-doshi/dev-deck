# Implementation Plan

This plan defines the next documentation-to-implementation slice for product validation. It does not authorize release-hardening work or broad new feature expansion.

## Phase 1: Create product-validation docs

Deliverables:

- complete `Docs/product-validation/` pack
- short docs index link from `Docs/README.md` if suitable

Exit criteria:

- product-validation docs exist and are coherent
- every document ties back to the minimum proof
- no release-hardening work is introduced

## Phase 2: Build complex stack fixture

Deliverables:

- `benchmarks/fixtures/complex-saas-stack/`
- service graph, env model, seeded data, health checks, and deterministic failure injection
- scenario metadata for startup, diagnosis, recovery, and shutdown tasks

Exit criteria:

- fixture matches the specification in `03-complex-stack-fixture.md`
- failure modes are deterministic enough for repeated runs
- the fixture is realistic enough to create manual orchestration pain

## Phase 3: Implement strict agent instruction generation

Deliverables:

- strict `AGENTS.md` generator
- sibling outputs for `CLAUDE.md`, `.cursor/rules/devdeck.mdc`, and `.devdeck/agent-protocol.md`
- first version of `npx devdeck agent install --strict`

Exit criteria:

- generated instructions encode the bounded runtime loop
- generated files are suitable for benchmark variants
- instruction generation does not pull in unrelated release docs

## Phase 4: Implement or optimize compact lifecycle commands

Required commands:

- `start --agent --wait`
- `stop --agent`
- `service restart --agent --wait`

Deliverables:

- bounded agent output
- wait semantics tied to readiness and health
- typed failure states for startup and restart
- stop verification strong enough to detect orphaned processes

Exit criteria:

- commands support the minimum use case flow
- command outputs are stable enough for repeated agent use
- lifecycle commands can be benchmarked against manual orchestration

## Phase 5: Implement first deterministic `diagnose --agent`

Deliverables:

- first bounded diagnosis command for whole-stack or targeted runtime failures
- typed findings with evidence and next actions
- support for the highest-value initial failure modes

Priority failure modes:

- missing env
- port conflict
- DB not ready
- Redis unavailable
- API crash after startup
- migration failure
- stale session
- orphan process

Exit criteria:

- diagnosis is useful before raw logs in common cases
- benchmark protocol can test `devdeck-strict-plus-diagnose`

## Phase 6: Build live-agent benchmark runner and protocol

Deliverables:

- live-agent harness configuration for the complex fixture
- transcript capture and command attribution
- provider token capture when available
- reporting tables for comparison modes

Exit criteria:

- benchmark methodology can produce a table comparing manual vs DevDeck agent loops
- comparison modes match `07-live-agent-benchmark-methodology.md`
- task prompts are held constant across modes

## Phase 7: Run the comparison set

Required comparison runs:

- manual agent
- DevDeck no instructions
- DevDeck current instructions
- DevDeck strict instructions
- DevDeck strict plus diagnose

Future comparison:

- DevDeck MCP or tool-native adapter

Exit criteria:

- enough runs exist to compare startup, diagnosis, recovery, and shutdown behavior
- provider-reported token data is available for the primary claim whenever supported
- protocol violations are visible in the results

## Phase 8: Review results and classify features

Deliverables:

- benchmark result table
- feature classifications: keep, optimize, demote, or remove
- recommendation on whether the agent-first thesis is validated, unproven, or should be repositioned

Exit criteria:

- results can drive a concrete next engineering slice
- weak features are not protected from removal
- the product thesis is evaluated honestly

## Overall exit criteria

- product-validation docs exist and are coherent
- complex fixture is specified enough to build
- benchmark methodology can produce a table comparing manual vs DevDeck agent loops
- no release-hardening work is included
- next implementation slice is clear

## Recommended next implementation slice

After this documentation slice, the next implementation slice should be:

1. build `benchmarks/fixtures/complex-saas-stack/`
2. implement strict instruction generation for benchmark variants
3. add or tighten `start --agent --wait`, `stop --agent`, and `service restart --agent --wait`
4. implement the first deterministic `diagnose --agent`

Do not start with dashboard work or broad release polish. The next slice should exist to make the validation benchmark possible.
