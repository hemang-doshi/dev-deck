# Feature Decision Framework

DevDeck is an experiment-driven product. Features are not sacred. They stay only if they improve the minimum proof.

## Feature states

- proposed
- implemented
- under evaluation
- keep
- optimize
- demote
- remove

## Decision inputs

- token impact
- tool-call impact
- success impact
- behavior impact
- complexity cost
- maintenance cost

## How to use the framework

For every feature in the agent-first path, answer these questions:

- Does it lower provider-reported tokens?
- Does it lower runtime-management tool calls?
- Does it improve task success or root-cause accuracy?
- Does it change agent behavior in the intended direction?
- Is the implementation complexity justified by measured benefit?
- Is the maintenance cost justified by repeated benchmark value?

## Keep criteria

Keep a feature when benchmark evidence shows most of the following:

- lower provider-reported tokens than the relevant baseline or adjacent feature alternative
- fewer runtime-management tool calls
- equal or better task success
- positive behavior shaping for the agent loop
- acceptable implementation and maintenance cost

## Optimize criteria

Optimize a feature when it shows product signal but is not yet efficient enough:

- improves success or diagnosis quality but is still too verbose
- reduces some manual fallback but agents still overuse it
- is structurally correct but needs better defaults, stronger output bounds, or better next-action hints

## Demote criteria

Demote a feature when it is useful only as fallback, not as part of the default path:

- it helps only in edge cases
- it increases average tokens when used by default
- it causes agent overuse that weakens the main runtime loop

Demoted features should remain available but be removed from the recommended agent protocol.

## Remove criteria

Remove a feature when:

- it does not improve measured outcomes
- it increases tokens or tool calls without compensating success gains
- it duplicates stronger adjacent commands
- its complexity or maintenance cost is not justified by benchmark evidence

## Example decisions

- Keep `start --agent --wait` if it reduces startup coordination tokens and tool calls.
- Demote `snapshot --agent` if agents overuse it and it increases total tokens.
- Remove `logs --agent` from default protocol if `diagnose --agent` handles common failures better.
- Keep dashboard work out of scope unless it helps benchmark or debug protocol validation.

## Scope discipline

The framework exists to prevent attachment to features that sound agent-first but do not help the measured runtime loop.

When in doubt, prefer:

- fewer commands
- stronger bounded defaults
- deterministic next actions
- less feature surface

If a feature cannot defend itself in the benchmark table, it should not drive the roadmap.
