# Product Hypothesis

## Core hypothesis

DevDeck is worth building only if it measurably improves the real runtime loop for coding agents working in complex local applications.

DevDeck is not valuable just because it is cleaner.

DevDeck is valuable only if it improves the real agent loop.

Debugging is not the primary product. Runtime coordination is the primary product. Debugging is only justified if it improves agent efficiency and success.

## Hard minimum proof

DevDeck remains worth pursuing as agent-first infrastructure only if, on a realistic multi-service fixture and with the same task prompt, DevDeck plus agent instructions achieves equal or better task success with lower total provider-reported tokens and fewer runtime-management tool calls than manual agent orchestration.

## Product thesis under test

The thesis under test is that a bounded runtime control plane can outperform manual shell coordination for agents because it reduces repeated service startup commands, unbounded log scraping, trial-and-error diagnosis, and cleanup overhead across the full lifecycle of a local stack.

This is stronger than saying DevDeck can print compact summaries. Compact output matters only if it changes what the agent does next and lowers total runtime-management cost across the task.

## Why the v1.4 live-agent eval was not sufficient

The latest live-agent eval was useful as a warning, not as proof:

- DevDeck consumed more total tokens than the manual baseline in the current scenarios.
- Compact `--agent` output did not offset the fact that the agent still ran too many commands.
- The current scenarios were too narrow to establish whether DevDeck helps with realistic multi-service coordination pain.
- The evaluation did not yet define a strict behavior contract that forces the agent to use DevDeck first and stay inside a bounded runtime loop.
- The evaluation did not separate CLI ergonomics from instruction quality, so it is unclear whether the product gap is command behavior, repo guidance, or both.

## What DevDeck must prove

DevDeck must prove all of the following on realistic tasks:

- the agent chooses DevDeck first when `devdeck.yml` exists
- the agent starts the stack with fewer runtime-management actions than manual shell orchestration
- the agent can identify common runtime failures without dumping raw logs first
- the agent can recover the affected service without restarting everything unnecessarily
- the agent stops the stack cleanly and leaves fewer orphaned processes
- total provider-reported tokens and runtime-management tool calls are lower than the manual baseline for equal or better task success

## What failure means

Failure means any of the following:

- DevDeck consistently increases provider-reported tokens relative to manual orchestration
- DevDeck shifts the same work into more commands without reducing overall runtime-management cost
- the agent still falls back to raw service startup and raw log scraping in common scenarios
- strict repo instructions are required just to match the manual baseline, but still do not beat it
- `diagnose --agent` and related bounded commands do not materially improve root-cause speed or recovery quality

If those outcomes persist, DevDeck should be repositioned as a narrower helper or reduced in scope instead of expanded.

## What success means

Success means the minimum use case works repeatedly on a complex multi-service fixture:

- the same task prompt produces equal or better task completion with DevDeck
- provider-reported tokens are lower than the manual baseline
- runtime-management tool calls are lower than the manual baseline
- raw shell lifecycle commands become exceptional rather than normal
- the agent reaches root cause and recovery with fewer observation turns

## Validation-phase non-goals

- proving that DevDeck is a better dashboard
- proving that DevDeck is a better OSS package
- optimizing polished human output for its own sake
- adding broad debugging features that do not improve runtime coordination
- benchmarking toy fixtures and claiming general product value from them
- changing prompts to favor DevDeck over the manual baseline
