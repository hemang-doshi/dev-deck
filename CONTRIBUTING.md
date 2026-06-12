# Contributing to Agent DevDeck

## Project Philosophy

DevDeck is agent-first and human-friendly.

Every feature should reduce runtime and debugging ambiguity for coding agents without making the human workflow worse.

## Local Setup

```bash
npm install
npm run build
npm test
npm run lint
```

## Working on the CLI

- Keep command output bounded and predictable.
- Preserve non-interactive shell compatibility.
- Prefer structured output where the CLI already offers it.
- Avoid printing secrets, environment dumps, or unnecessary terminal noise.

## Working on Docs

- Keep install and usage examples aligned with the published package name: `@hemangdoshi/devdeck`.
- Use the `devdeck` binary in command examples.
- Document agent-facing and human-facing workflows separately when that distinction matters.
- Prefer examples that show bounded debugging patterns, not raw terminal sprawl.

## Agent Contract Checklist

Before opening a PR, check:

- output is bounded
- errors include DD error codes where relevant
- JSON output is stable where provided
- command works in non-interactive shells
- no secrets are printed
- docs include agent-facing examples
- behavior is testable from CLI

## Commit Style

Use small, focused commits.

Examples:

- `docs: tighten agent onboarding and install guidance`
- `feat(cli): add bounded snapshot output`
- `fix(server): preserve DD error code on startup failure`

## Pull Requests

- Explain the user or agent workflow being improved.
- Call out CLI contract changes explicitly.
- Include verification steps or test output when behavior changes.
- Keep docs in sync with any package-name, binary, or command-surface changes.
