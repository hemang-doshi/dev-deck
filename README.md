# Portfolio

Personal proof-of-work website for Hemang Doshi.

This repository is being built as a cinematic developer portfolio: a scroll-driven proof-of-work system rather than a conventional resume-style website. The intended experience starts with a full-bleed twilight desk hero, zooms into the workstation on scroll, reveals Hemang Doshi on the laptop interface, and then transitions into selected work, case studies, writing notes, and current-focus/status surfaces.

## Design Direction

The visual source of truth is the **Mercury / Mountain Top Command Center** style reference.

Core principles:

- dark, immersive command-center atmosphere
- full-bleed atmospheric hero imagery
- deep neutral surfaces with one disciplined blue accent
- elegant light-weight typography
- generous vertical spacing
- pill-shaped primary actions
- no heavy shadows; use borders, opacity, and surface shifts instead
- content should feel like a cohesive proof-of-work operating system, not a pasted portfolio template

## Documentation

- [`docs/design/README.md`](docs/design/README.md) — design-doc index
- [`docs/design/mercury-style-reference.md`](docs/design/mercury-style-reference.md) — style reference and usage rules
- [`docs/design/tokens.json`](docs/design/tokens.json) — structured design tokens
- [`docs/design/tailwind-v4-theme.css`](docs/design/tailwind-v4-theme.css) — Tailwind v4 theme variables and CSS custom properties
- [`docs/design/experience-brief.md`](docs/design/experience-brief.md) — portfolio experience model and page structure
- [`docs/design/implementation-plan.md`](docs/design/implementation-plan.md) — first implementation plan

## Intended Build Stack

- Next.js App Router
- TypeScript
- Tailwind CSS v4
- Motion for React
- static content files for work, case studies, and writing notes
- Vercel deployment

## Product Mental Model

Do not build this as:

```txt
hero + projects + about + footer
```

Build it as:

```txt
world → workstation → system → evidence
```

That is the core creative constraint for the site.
