You are debugging a local multi-service Node.js development stack.

You may use shell commands only.

Do not use DevDeck commands.

Your task:
1. Start the required services.
2. Inspect health.
3. Identify any failing service or warning signal.
4. Identify the root cause if a service fails.
5. Recover the service if recovery is needed.
6. Verify final health.
7. Stop the stack cleanly.
7. Finish with a concise final answer containing:
   - failed service, if any
   - root cause, if any
   - recovery action taken, if any
   - final health result

Prefer bounded commands.
Prefer direct health checks, targeted process inspection, and bounded log reads over noisy shell polling.
Avoid reading unnecessary logs.
Do not modify application source files, `package.json`, or `devdeck.yml`.
