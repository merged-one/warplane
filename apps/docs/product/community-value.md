# Community Value

What the Milestone 1 MVP provides for Avalanche L1 developers and subnet operators.

## The Problem

Avalanche L1 operators using Teleporter for cross-chain messaging lack visibility into message lifecycles. When a message fails to deliver, gets retried, or triggers replay protection, there is no unified tool to trace what happened, where it failed, and why.

## What Warplane Provides Today

### Canonical Trace Model

A typed, schema-validated model for the full Teleporter message lifecycle with 11 event kinds covering send, relay, delivery, failure, retry, fee addition, receipt delivery, and replay protection. This model is defined once in Zod and generates TypeScript types, JSON Schema, and OpenAPI specs.

### Deterministic Test Scenarios

Five scenarios that exercise the critical Teleporter code paths:

| Scenario                      | What It Validates                    |
| ----------------------------- | ------------------------------------ |
| `basic_send_receive`          | Full happy-path delivery             |
| `add_fee`                     | Fee addition via `AddFeeAmount`      |
| `specified_receipts`          | Batch receipt delivery               |
| `retry_failed_execution`      | Failure detection and retry recovery |
| `replay_or_duplicate_blocked` | Replay protection enforcement        |

### Query and Visualization Tools

- **REST API** with OpenAPI 3.1 docs for programmatic access to traces, scenarios, chains, and network topology
- **Web dashboard** with trace timeline visualization, failure views, and scenario coverage
- **CLI** for terminal-based querying with JSON output for scripting

### Reproducible Local Environment

One command (`pnpm demo:seed`) brings up the full stack with seeded golden data. No AvalancheGo binaries, no external services, no configuration.

## Who Benefits

| Role                   | Value                                                              |
| ---------------------- | ------------------------------------------------------------------ |
| **Subnet operators**   | Trace message failures across chains without manual log parsing    |
| **Relayer operators**  | Verify relay delivery and fee handling                             |
| **dApp developers**    | Test cross-chain message flows against deterministic scenarios     |
| **Protocol engineers** | Validate Teleporter behavior changes against a known-good baseline |
| **Tooling builders**   | Build on typed schemas and OpenAPI specs instead of ad-hoc parsing |

## What Comes Next (Milestone 2)

- Live Avalanche RPC polling for real-time trace ingestion
- Full E2E test wiring with real tmpnet networks
- Docker Compose for one-command deployment
- Storage adapter flexibility (Postgres option)

See the [roadmap](/planning/roadmap) for the full breakdown.
