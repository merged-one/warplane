# Warplane -- Decision Index

This file indexes all Architecture Decision Records (ADRs) for quick reference.
Full records are in [`docs/decisions/`](../decisions/README.md).

| ADR                                                                | Title                                                | Status   | Date       |
| ------------------------------------------------------------------ | ---------------------------------------------------- | -------- | ---------- |
| [0001](../decisions/0001-use-structured-madr.md)                   | Use Structured MADR for architecture decisions       | Accepted | 2026-04-01 |
| [0002](../decisions/0002-use-monorepo-with-ts-and-go.md)           | Use monorepo with TypeScript and Go                  | Accepted | 2026-04-01 |
| [0003](../decisions/0003-fixture-first-day1-mvp.md)                | Fixture-first approach for Day-1 MVP                 | Accepted | 2026-04-01 |
| [0004](../decisions/0004-zod-single-schema-approach.md)            | Zod as single schema source for domain model         | Accepted | 2026-04-01 |
| [0005](../decisions/0005-rpc-first-multi-source-ingestion.md)      | RPC-first multi-source data ingestion                | Accepted | 2026-04-02 |
| [0006](../decisions/0006-event-model-contract-alignment.md)        | Event model aligned to TeleporterMessenger contracts | Accepted | 2026-04-02 |
| [0007](../decisions/0007-four-milestone-grant-delivery.md)         | Four-milestone grant delivery structure              | Accepted | 2026-04-02 |
| [0008](../decisions/0008-prometheus-offchain-event-correlation.md) | Prometheus-based off-chain event correlation         | Accepted | 2026-04-02 |

## How to add a new decision

```bash
node scripts/new-adr.mjs "Title of decision"
```

See [ADR README](../decisions/README.md) for the full process.
