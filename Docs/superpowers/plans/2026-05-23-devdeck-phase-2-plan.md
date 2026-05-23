# DevDeck Phase 2 Execution Plan

1. Write config-loader tests for discovery, parse failures, missing fields, invalid `cwd`, and duplicate service names.
   Verify: `npm run test --workspace @devdeck/config`
2. Implement minimal config discovery, YAML parsing, validation, and readable config errors.
   Verify: config tests pass.
3. Write CLI tests for `devdeck init` and the parse-and-print `devdeck dev` skeleton.
   Verify: `npm run test --workspace @devdeck/cli`
4. Implement the CLI command entrypoints and keep user-facing failures plain.
   Verify: `npm run build --workspace @devdeck/config`, `npm run build --workspace @devdeck/cli`, and manual dry runs succeed.
