# Security Policy

## Supported Versions

The current supported public release is `v1.3.x`.

## Local-First Security Model

DevDeck is designed to run on the developer's own machine.

By default, DevDeck serves the local dashboard on localhost:

`http://127.0.0.1:4545`

Do not expose this dashboard to the public internet.

## Process Execution Model

DevDeck runs the commands you define in `devdeck.yml`.

Treat `devdeck.yml` like executable project configuration. Do not run untrusted DevDeck configs without reviewing the commands first.

## Logs and Secrets

DevDeck captures service stdout/stderr into bounded logs and snapshots.

If your application prints secrets, tokens, credentials, database URLs, or private user data, DevDeck may display that output.

Before sharing any of the following publicly, review and redact sensitive information:

- `npx devdeck logs`
- `npx devdeck snapshot`
- `.devdeck/devdeck.log`
- screenshots of the dashboard

## Reporting a Vulnerability

Please report security issues privately instead of opening a public issue.

Use GitHub Security Advisories if available, or contact the maintainer directly.

## Out of Scope

The following are generally outside DevDeck's security scope:

- vulnerabilities inside user applications launched by DevDeck
- secrets printed by user-defined commands
- intentionally exposed localhost ports
- malicious commands placed inside untrusted `devdeck.yml` files
