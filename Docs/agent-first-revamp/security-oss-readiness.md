# Security and OSS Readiness

DevDeck is local-first, but it controls developer processes and exposes a local API. The default threat model must be conservative.

## Local security model

Required defaults:

- Bind the API server to `127.0.0.1` by default.
- Do not bind to `0.0.0.0` unless explicitly requested.
- Do not enable remote control by default.
- Redact known secret environment keys from logs, snapshots, exports, and JSON responses.
- Do not print full environment variables by default.
- Use same-origin assumptions for dashboard actions.
- Consider an optional local auth token for API access.
- Do not collect telemetry by default.

## Secret redaction

Default redaction should match common key names:

```txt
*_TOKEN
*_SECRET
*_KEY
PASSWORD
DATABASE_URL
OPENAI_API_KEY
ANTHROPIC_API_KEY
HF_TOKEN
GITHUB_TOKEN
```

Users can extend this through `defaults.log.redact`.

## Command execution policy

DevDeck executes local commands from `devdeck.yml`. Therefore:

- Never auto-run a downloaded config without user review.
- `init --detect` may suggest config but should not execute it automatically.
- Future plugins/templates must be explicit and reviewable.
- Dashboard should show command/cwd before destructive actions where practical.

## Package identity decision

Before OSS launch, freeze the install identity. The repo currently has evidence of scoped package usage, while docs may still refer to unscoped install commands. This must be resolved before marketing or public release.

Preferred long-term identity:

```txt
npm package: @devdeck/cli
binary: devdeck
repo: devdeck/devdeck
```

Acceptable interim identity:

```txt
npm package: @hemangdoshi/devdeck
binary: devdeck
repo: hemang-doshi/dev-deck
```

Do not leave docs, package name, and npm install commands inconsistent.

## OSS release checklist

- LICENSE present and correct.
- README install command matches actual package.
- `CONTRIBUTING.md` exists.
- `CODE_OF_CONDUCT.md` exists if community contributions are encouraged.
- `SECURITY.md` explains vulnerability reporting.
- `CHANGELOG.md` is maintained.
- CI runs build, test, lint, and fixture tests.
- Example projects are included.
- Public docs explain compatibility and migration.
- Error codes are documented.
- JSON contracts are versioned.

## Telemetry policy

Default: no telemetry.

If telemetry is ever added:

- opt-in only;
- document exact payloads;
- never collect command output, logs, env values, file paths, or secrets by default;
- provide a hard disable environment variable.
