# DevDeck Brand Refresh Design

## Objective

Apply a focused brand refresh that replaces the current mixed `Agent DevDeck` presentation with a single public product identity: `DevDeck`.

This is a bounded branding slice, not a product rewrite. The goal is to make the repository and app feel like a coherent OSS tool for agents and developers using:

- the provided full wordmark image as the canonical repo-facing logo
- a derived simplified icon for app-facing surfaces
- tighter public naming and positioning copy

## Approved Direction

The approved approach is:

- use the provided PNG as the full branded logo for repo-facing surfaces
- derive a separate simplified icon for app surfaces
- standardize the public product name to `DevDeck`
- position the tool as being for agents and developers without keeping `Agent DevDeck` as the formal name

## In Scope

### Asset layer

- add the provided full wordmark asset into the tracked repository asset set
- create a simplified icon-only derivative based on the left-side terminal-card mark in the provided logo
- keep asset naming stable and explicit so README and dashboard surfaces can reference them cleanly

### Repo-facing surfaces

- update the top branding treatment in `README.md`
- replace obvious public-facing `Agent DevDeck` naming with `DevDeck`
- tighten short descriptive copy so the repo reads as a serious OSS runtime tool for agents and developers

### App-facing surfaces

- update dashboard/browser title text from `Agent DevDeck` to `DevDeck` where applicable
- add or wire favicon/icon assets through the existing static asset path if feasible within the current dashboard serving model
- update obvious UI header/title surfaces that expose outdated branding

### Lightweight metadata cleanup

- update directly user-facing package descriptions or similar metadata only where it supports the public brand refresh
- avoid unrelated package or release changes

## Out of Scope

- dashboard redesign
- launch-copy rewrite
- README expansion unrelated to branding
- package version bumps
- new runtime behavior
- benchmark methodology changes
- release-hardening work

## Brand Model

### Product name

The public product name is `DevDeck`.

`Agent DevDeck` should be treated as legacy wording and removed from public-facing naming surfaces unless a specific internal artifact requires historical preservation.

### Positioning

The core positioning should remain explicit:

- DevDeck is a local runtime control plane
- it is designed for both AI coding agents and human developers
- it helps manage multi-service development stacks with a bounded interface

This keeps the agent-first thesis visible without making the formal product name awkward.

### Asset roles

- full wordmark: repo/docs/social-style display where logo plus name is appropriate
- simplified icon: dashboard, browser tab, favicon, compact app surfaces

The simplified icon should come from the existing visual language of the provided logo rather than introducing a second brand system.

## Implementation Strategy

### 1. Add canonical brand assets

Store the provided full logo in the repo asset folder and introduce a derived icon asset beside it.

Expected result:

- one full logo asset for README/docs
- one compact icon asset for app/favicon usage

If the current repo only has `assets/icon.png`, preserve backward compatibility where practical but migrate public references to the new asset names.

### 2. Normalize repo-facing branding

Update public-facing documentation entry points to:

- show the new full wordmark
- use `DevDeck` consistently
- describe the product as an OSS runtime tool for agents and developers

This should be a targeted pass, not a documentation rewrite.

### 3. Normalize app-facing branding

Use the existing dashboard asset serving model to expose favicon/icon assets. If current routing only serves static files generically, add the minimum necessary file placement and references rather than building new asset infrastructure.

Expected user-visible changes:

- browser tab title says `DevDeck`
- favicon/icon reflects the simplified brand mark
- any obvious dashboard header/title text uses `DevDeck`

### 4. Keep branding changes bounded

Do not broaden the slice into UI redesign or content strategy. Any text changes should support consistency and trust, not create new product claims.

## Technical Notes

- Prefer tracked static assets over generated-at-runtime branding.
- Reuse the existing server static asset loading path for dashboard assets.
- Keep implementation compatible with the current dashboard packaging/layout rather than introducing a frontend build dependency.
- If favicon support requires only static file placement and HTML reference changes, prefer that.

## Risks

### Risk: repo/app branding diverges

Mitigation:

- use one approved wordmark source
- derive the compact icon from the same mark
- normalize naming to `DevDeck` everywhere public-facing

### Risk: branding pass turns into copy churn

Mitigation:

- limit copy edits to headings, titles, short descriptors, and clearly public-facing strings
- avoid rewriting roadmap, benchmarks, or product-validation docs

### Risk: app asset hookup is more coupled than expected

Mitigation:

- use the smallest possible change in the dashboard asset path
- if some deeper app surface is not easily reachable, prioritize browser title and favicon first

## Acceptance Criteria

- the repo has a tracked full-logo asset derived from the provided PNG
- the repo has a tracked simplified icon asset for app surfaces
- `README.md` presents the new brand coherently
- obvious public-facing `Agent DevDeck` naming is replaced with `DevDeck`
- dashboard/browser-facing title and icon surfaces are updated where supported by the current app
- no unrelated runtime behavior or release-hardening work is introduced

## Implementation Order

1. Add new brand assets.
2. Update repo-facing logo and copy references.
3. Update dashboard/app title and icon surfaces.
4. Run lightweight verification on affected surfaces.

## Verification Plan

- inspect changed asset references in README and app files
- run any lightweight existing tests affected by branding string changes
- if the dashboard can be launched locally without extra setup, verify title/icon presentation in the served app
- confirm there are no unrelated product or benchmark changes in the final diff
