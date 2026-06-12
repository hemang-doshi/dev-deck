## Summary

Describe what changed.

## Why?

Explain the user, human-developer, or coding-agent workflow this improves.

## Type of Change

- [ ] CLI behavior
- [ ] Agent contract / JSON output
- [ ] Dashboard
- [ ] Documentation
- [ ] Benchmarking
- [ ] Release / packaging
- [ ] Tests
- [ ] Refactor

## Agent-First Checklist

- [ ] Output is bounded and avoids unnecessary terminal noise.
- [ ] Commands work in non-interactive shells.
- [ ] JSON output is stable where applicable.
- [ ] Errors include `DD-ERR-XXXX` codes where relevant.
- [ ] Troubleshooting hints are actionable.
- [ ] No secrets, environment dumps, or sensitive paths are intentionally printed.
- [ ] Documentation includes agent-facing examples where relevant.
- [ ] Behavior can be verified from the CLI.

## Testing

- [ ] `npm run build`
- [ ] `npm test`
- [ ] `npm run lint`
- [ ] Manual CLI smoke test

## Manual CLI Smoke Test

Paste relevant output if this PR changes CLI behavior:

```bash
npx devdeck --version
npx devdeck status
npx devdeck snapshot
```

## Screenshots / Logs

Add screenshots, terminal output, or dashboard captures if relevant.

## Notes for Reviewers

Anything reviewers should pay special attention to?
