# Architecture Decision Records

Warplane uses [Structured MADR](https://adr.github.io/madr/) for recording architecture decisions.

## Decisions

| ADR                                                 | Title                                          | Status   |
| --------------------------------------------------- | ---------------------------------------------- | -------- |
| [0001](/decisions/0001-use-structured-madr)         | Use Structured MADR for architecture decisions | Accepted |
| [0002](/decisions/0002-use-monorepo-with-ts-and-go) | Use monorepo with TypeScript and Go            | Accepted |
| [0003](/decisions/0003-fixture-first-day1-mvp)      | Fixture-first approach for Day-1 MVP           | Accepted |

## Creating a New ADR

```bash
node scripts/new-adr.mjs "Title of your decision"
```

## ADR Lifecycle

| Status     | Meaning                   |
| ---------- | ------------------------- |
| Proposed   | Under discussion          |
| Accepted   | In effect                 |
| Deprecated | Superseded by a later ADR |

ADR structure is validated in CI via `.github/workflows/adr-validation.yml`.
