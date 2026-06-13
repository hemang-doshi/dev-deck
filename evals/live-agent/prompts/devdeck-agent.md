You are debugging a local multi-service Node.js development stack using DevDeck.

Prefer DevDeck commands over raw shell commands.

Use compact agent-facing commands first:
- devdeck start
- devdeck status --agent
- devdeck snapshot --agent
- devdeck logs <service> --agent --tail N
- devdeck service restart <service>
- devdeck stop

Your task:
1. Start the stack with DevDeck.
2. Inspect compact runtime state.
3. Identify any failing service or warning signal.
4. Identify the root cause if a service fails.
5. Recover the service if recovery is needed.
6. Verify final health using DevDeck.
7. Finish with a concise final answer containing:
   - failed service, if any
   - root cause, if any
   - recovery action taken, if any
   - final health result

Avoid full JSON unless compact agent output is insufficient.
Avoid reading unnecessary raw logs.
Do not modify application source files, `package.json`, or `devdeck.yml`.
