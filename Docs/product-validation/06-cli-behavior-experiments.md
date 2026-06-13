# CLI Behavior Experiments

This document ties each proposed CLI behavior to a testable product hypothesis. Features are not sacred. If benchmark evidence does not justify them, they should be optimized, demoted, or removed.

## Experiment template

- Feature:
- Hypothesis:
- Expected agent behavior:
- Benchmark scenario:
- Keep criteria:
- Optimize criteria:
- Remove or demote criteria:

## `start --agent --wait`

- Feature: `npx devdeck start --agent --wait`
- Hypothesis: a bounded startup command with wait semantics reduces startup coordination tokens and tool calls versus manual multi-service bring-up.
- Expected agent behavior: use one startup command, wait for readiness, then verify once with `status --agent`.
- Benchmark scenario: cold start of the complex SaaS stack with one dependency delay and one normal successful start.
- Keep criteria: lowers runtime-management tool calls and startup tokens while reaching healthy state at least as reliably as manual orchestration.
- Optimize criteria: improves startup success but still causes extra follow-up checks or repeated polling.
- Remove or demote criteria: agents still need manual startup inspection or the command increases total runtime-management cost versus baseline.

## `stop --agent`

- Feature: `npx devdeck stop --agent`
- Hypothesis: one bounded stop command reduces cleanup overhead and orphan risk at the end of the task.
- Expected agent behavior: stop once through DevDeck and avoid manual `pkill`, `kill`, `lsof`, or port cleanup unless DevDeck fails.
- Benchmark scenario: normal shutdown and orphan-process failure injection.
- Keep criteria: fewer cleanup commands and fewer orphaned processes than manual stop behavior.
- Optimize criteria: generally works but still needs follow-up verification too often.
- Remove or demote criteria: stop reliability is poor enough that agents routinely fall back to manual cleanup.

## `status --agent`

- Feature: `npx devdeck status --agent`
- Hypothesis: compact stack state reduces repeated shell probing after startup and after recovery.
- Expected agent behavior: inspect stack state through DevDeck rather than checking individual ports, processes, or multiple HTTP endpoints.
- Benchmark scenario: healthy startup, degraded dependency, and post-restart verification.
- Keep criteria: replaces multiple manual inspection commands with one or two bounded status checks.
- Optimize criteria: useful but not enough to identify the next action without additional diagnosis too often.
- Remove or demote criteria: agents still need raw probing because status does not explain degraded state well enough.

## `diagnose --agent`

- Feature: `npx devdeck diagnose --agent`
- Hypothesis: deterministic diagnosis before raw logs reduces root-cause tokens and time.
- Expected agent behavior: call `diagnose --agent` before log dumps and apply the recommended action quickly.
- Benchmark scenario: missing env, DB not ready, Redis unavailable, API crash after startup, migration failure, and frontend/API mismatch.
- Keep criteria: materially improves root-cause speed or accuracy while reducing raw log tokens and runtime-management tool calls.
- Optimize criteria: correct diagnosis often, but with noisy or verbose output that limits token savings.
- Remove or demote criteria: agents still need raw logs first for common failures, or the command adds cost without improving recovery.

## `service restart <name> --agent --wait`

- Feature: `npx devdeck service restart <name> --agent --wait`
- Hypothesis: targeted restart with wait semantics reduces unnecessary full-stack churn and follow-up checks.
- Expected agent behavior: restart only the affected service or dependency named by diagnosis.
- Benchmark scenario: API crash after startup, worker stuck queue, and frontend/API mismatch after backend fix.
- Keep criteria: lower recovery tool-call count and faster return to healthy state than manual targeted restart or full-stack restart.
- Optimize criteria: targeted restart works but wait semantics or post-restart reporting are insufficiently clear.
- Remove or demote criteria: agents still choose full-stack restart because targeted restart is unreliable or ambiguous.

## `logs --agent`

- Feature: `npx devdeck logs --agent`
- Hypothesis: bounded logs are useful as a fallback after diagnosis, not as the default first diagnostic step.
- Expected agent behavior: use only after `diagnose --agent` when targeted evidence is still required.
- Benchmark scenario: noisy worker logs, migration failure, and non-deterministic error context that diagnosis cannot fully summarize.
- Keep criteria: useful as a second-line tool with bounded output and limited command overuse.
- Optimize criteria: valuable, but agents overuse it because diagnosis does not provide enough evidence.
- Remove or demote criteria: `diagnose --agent` is sufficient for common failures and logs mostly add token cost.

`logs --agent` should become fallback if `diagnose --agent` is sufficient.

## `snapshot --agent`

- Feature: `npx devdeck snapshot --agent`
- Hypothesis: a compact multi-service snapshot may help when the stack state spans several services, but it should not remain in the default path unless it improves task outcomes.
- Expected agent behavior: use only when the task requires a cross-service summary that status and diagnose do not already provide.
- Benchmark scenario: cross-service degradation involving API, worker, and Redis, plus stale session investigation.
- Keep criteria: improves success or diagnosis speed without increasing total provider-reported tokens.
- Optimize criteria: occasionally helpful but too verbose or too easy for agents to overuse.
- Remove or demote criteria: increases total tokens or command count without improving task success.

`snapshot --agent` should not remain in the default agent path unless it improves success without increasing total tokens.

## `agent install --strict`

- Feature: `npx devdeck agent install --strict`
- Hypothesis: generated strict repo instructions can materially increase DevDeck-first behavior and reduce manual fallback.
- Expected agent behavior: follow the bounded runtime loop more consistently across cold starts and failure cases.
- Benchmark scenario: compare no instructions, current instructions, strict generated instructions, and strict instructions plus future skill support.
- Keep criteria: measurable reduction in provider-reported tokens, runtime-management tool calls, or raw shell fallback.
- Optimize criteria: improves adherence but generated instruction quality is uneven across agent ecosystems.
- Remove or demote criteria: generated files add maintenance overhead without changing measured behavior.

## Evaluation rule

No CLI feature should remain in the primary agent protocol because it sounds useful. It should remain only if it earns its place in benchmark evidence.
