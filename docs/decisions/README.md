# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for the Warplane project,
using [Structured MADR](https://adr.github.io/madr/) format.

## Decisions

| ADR | Title | Status |
|-----|-------|--------|
| [0001](0001-use-structured-madr.md) | Use Structured MADR for architecture decisions | Accepted |
| [0002](0002-use-monorepo-with-ts-and-go.md) | Use monorepo with TypeScript and Go | Accepted |
| [0003](0003-fixture-first-day1-mvp.md) | Fixture-first approach for Day-1 MVP | Accepted |

## Creating a new ADR

```bash
node scripts/new-adr.mjs "Title of your decision"
```

This scaffolds a new ADR from the [Structured MADR template](templates/structured-madr.md),
assigns the next sequential number, and opens it for editing.

After writing the ADR:

1. Update the table above
2. Update [`docs/planning/decision-index.md`](../planning/decision-index.md)
3. Commit with message: `Add ADR-NNNN: Title`

## ADR lifecycle

| Status | Meaning |
|--------|---------|
| Proposed | Under discussion, not yet decided |
| Accepted | Decision made, in effect |
| Deprecated | Superseded by a later ADR |
| Superseded | Replaced by another ADR (link to successor) |

## Validation

ADR structure is validated in CI via `.github/workflows/adr-validation.yml`.
Every ADR file (`docs/decisions/NNNN-*.md`) must contain the required MADR sections.

## Links

- [Decision index](../planning/decision-index.md)
- [MADR homepage](https://adr.github.io/madr/)
