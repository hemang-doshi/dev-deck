# DevDeck

Local-first developer session orchestration for running multiple services and inspecting their state in one place.

## Setup

```bash
npm install
npm run build
npm run test
```

Run the local CLI from the repo after building:

```bash
node packages/cli/dist/index.js init
node packages/cli/dist/index.js dev
```

## Example

The MVP demo project lives in [`examples/fullstack-basic/`](/Users/hemangdoshi/Developer/dev-deck/examples/fullstack-basic).

```bash
cd examples/fullstack-basic
node ../../packages/cli/dist/index.js dev
```

## Supported Platforms

- macOS
- Linux

## Known Limitations

- Session state is in-memory only.
- The dashboard is served locally and expects the CLI runtime to stay alive.
- `devdeck init` currently writes a starter file instead of prompting interactively.
- The dashboard UI is intentionally minimal while the runtime contracts stabilize.

## Current Non-Goals

- Persistent log storage
- Remote collaboration or hosted backends
- Container orchestration
- Production monitoring

Source specifications remain under [`Docs/`](/Users/hemangdoshi/Developer/dev-deck/Docs).
