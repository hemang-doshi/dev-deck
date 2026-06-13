# Live-Agent Benchmark Methodology

## Benchmark question

Does DevDeck reduce real agent runtime-management cost on a realistic multi-service repository compared with manual shell orchestration, using the same task prompt and the same agent runtime?

## Agents under test

Start with Codex CLI because it is the closest current evaluation target.

Future runs may add other agents, but they should be treated as separate comparison sets rather than mixed into one headline number.

## Comparison modes

1. `manual-agent-runtime`
2. `devdeck-no-instructions`
3. `devdeck-current-instructions`
4. `devdeck-strict-instructions`
5. `devdeck-strict-plus-diagnose`
6. future `devdeck-mcp`

These modes differ only in repo setup and available DevDeck behavior. The task prompt must remain identical.

## Metrics

- provider-reported total tokens
- transcript tokens
- prompt tokens
- model output tokens
- tool observation tokens
- total tool calls
- runtime-management tool calls
- raw log tokens
- time to healthy state
- time to root cause
- final success or failure
- root cause accuracy
- orphaned processes
- whether the agent stopped services

## Prompt design

The benchmark prompt must describe the task outcome, not the preferred tool choice.

The prompt must be identical across manual and DevDeck modes. DevDeck is not allowed to win through a better task prompt. Only repo setup and instructions differ.

Prompts should be short enough to avoid front-loading the answer. The benchmark is about runtime behavior, not prompt tutoring.

## Example task prompts

- Start the app, verify it is healthy, and stop it cleanly.
- Diagnose a runtime failure and recover the stack.
- Fix a frontend/API issue that requires the full stack to be running.
- Investigate a worker/queue issue.

Each prompt should map to one or more deterministic fixture scenarios with predefined scoring expectations.

## Transcript capture

For each run, capture:

- full assistant transcript
- full tool invocation sequence
- raw tool observations
- final assistant answer
- benchmark metadata such as mode, fixture version, scenario, agent runtime, and date

Transcript capture should preserve exact command attribution so runtime-management cost can be traced to specific actions.

## Provider token capture

Provider-reported usage is the primary metric whenever the agent runtime exposes it.

If provider usage is unavailable, the run should be labeled as incomplete for the minimum-proof claim. Local transcript tokenization can still be recorded for diagnostics, but it should not replace provider-reported totals when making product decisions.

## Command attribution

Every command or tool call should be classified into one of these buckets:

- runtime startup
- runtime inspection
- diagnosis
- recovery
- code inspection or editing
- test or verification
- cleanup
- unrelated noise

Runtime-management tool calls are the sum of startup, inspection, diagnosis, recovery, and cleanup calls.

## Success scoring

A run is successful only if it satisfies the scenario outcome and leaves the runtime in the expected final state.

Minimum success checks:

- required service state reached
- expected failure or root cause identified
- appropriate recovery action applied when relevant
- final health verified
- stack stopped when the task requires shutdown

## Failure scoring

A run should be marked failed if any of the following occur:

- wrong root cause
- incomplete recovery
- unhealthy final stack
- orphaned processes left behind
- stack not stopped when required
- prompt abandoned or task unresolved

## Root cause accuracy

Root cause accuracy should be scored separately from final success because a lucky recovery is weaker evidence than correct diagnosis.

Suggested scoring:

- `correct`
- `partially-correct`
- `incorrect`
- `not-stated`

## Cold start vs warm session

The methodology should include both:

- cold start: no active session, no warmed service state
- warm session: prior context exists, one service or dependency degrades after the stack is already running

DevDeck must prove value in both startup and recovery loops, not just one.

## Raw shell vs optimized shell

The manual baseline should eventually test both:

- raw shell baseline using common generic commands
- optimized shell baseline where the agent is allowed to be competent and efficient manually

DevDeck must beat a competent manual path, not just a sloppy one.

## Manual baseline vs DevDeck path

The comparison should explicitly separate:

- manual lifecycle orchestration through raw shell
- DevDeck lifecycle orchestration through bounded commands

Code editing work can be shared between both paths when the scenario requires a fix. The benchmark question is whether DevDeck reduces the runtime-management tax around that work.

## Reporting format

Each scenario should produce:

- one row per comparison mode
- exact token and tool-call metrics
- command attribution summary
- success and root-cause scoring
- notes on protocol violations such as raw log dumps or manual startup in DevDeck modes

The final table should make it obvious whether DevDeck actually reduced runtime-management cost or merely shifted it around.
