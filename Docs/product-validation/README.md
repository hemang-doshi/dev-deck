# Product Validation Pack

This pack exists to answer one product question, not to make DevDeck look more complete.

DevDeck is being treated here as a hypothesis under test, not as a product that has already earned more surface area. This is a product-validation pack, not a release-hardening pack.

The minimum proof is narrow and unforgiving: a real coding agent operating a realistic multi-service repository must spend fewer tokens and fewer runtime-management tool calls starting, inspecting, diagnosing, recovering, and stopping the stack with DevDeck than with manual shell orchestration, while achieving equal or better task success.

If that proof cannot be established in real agent loops, DevDeck should be repositioned as a narrower helper or cut back rather than expanded.

## Reading order

1. [01-product-hypothesis.md](01-product-hypothesis.md)
2. [02-minimum-use-case.md](02-minimum-use-case.md)
3. [03-complex-stack-fixture.md](03-complex-stack-fixture.md)
4. [04-agent-behavior-protocol.md](04-agent-behavior-protocol.md)
5. [05-skill-and-instruction-strategy.md](05-skill-and-instruction-strategy.md)
6. [06-cli-behavior-experiments.md](06-cli-behavior-experiments.md)
7. [07-live-agent-benchmark-methodology.md](07-live-agent-benchmark-methodology.md)
8. [08-feature-decision-framework.md](08-feature-decision-framework.md)
9. [09-implementation-plan.md](09-implementation-plan.md)

## In scope

- product hypothesis and minimum proof definition
- a realistic benchmark fixture specification
- strict agent behavior rules for runtime management
- instruction and skill experiments that can change agent behavior
- CLI feature evaluation tied to benchmark evidence
- a live-agent methodology that compares manual and DevDeck loops fairly
- an implementation sequence for the next technical slice

## Out of scope

- OSS release hardening
- security policy expansion
- contribution docs
- package identity cleanup
- dashboard redesign
- launch copy
- feature work that is not justified by benchmark evidence

## Warning

Do not read this pack as a justification to keep building features until something eventually works. Read it as a kill test. If DevDeck cannot prove the minimum use case on a realistic multi-service fixture, the agent-first thesis is not validated.
