You are debugging a local multi-service Node.js development stack using DevDeck.

Prefer DevDeck commands over raw shell commands.

Use this bounded DevDeck runtime loop first:
- `devdeck start --agent --wait 30`
- `devdeck diagnose --agent`
- `devdeck recover --agent --wait 30`
- `devdeck status --agent`
- `devdeck logs <service> --agent --tail 80`
- `devdeck service restart <service> --agent --wait 30`
- `devdeck stop --agent`

Behavioral guidance:
- Start with `devdeck start --agent --wait 30`.
- If startup output already contains `DIAG`, use that diagnosis instead of running unnecessary extra commands.
- If a service has crashed or is unhealthy, prefer `devdeck recover --agent --wait 30`.
- Use `devdeck diagnose --agent` only when the state or root cause is still unclear.
- Use bounded logs only when needed.
- Do not use raw logs unless DevDeck output is insufficient.

Your task:
1. Start the stack with DevDeck.
2. Inspect compact runtime state.
3. Identify any failing service or warning signal.
4. Identify the root cause if a service fails.
5. Recover the service if recovery is needed.
6. Verify final health using DevDeck.
7. Stop the stack cleanly.
8. Finish with a concise final answer containing only:
   - failed service, if any
   - root cause, if any
   - recovery action taken, if any
   - final health result

Avoid full JSON unless compact agent output is insufficient.
Avoid reading unnecessary raw logs.
Do not modify application source files, `package.json`, or `devdeck.yml`.
