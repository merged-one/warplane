# ADR-0003: Fixture-First Approach for Day-1 MVP

## Status

Accepted

## Date

2026-04-01

## Context and Problem Statement

Milestone 1 aims to ship a working monorepo skeleton quickly. The ingest pipeline,
storage layer, and API need to return data, but integrating with real Avalanche nodes
and databases adds significant complexity and risk. We need to decide how to handle
data in the MVP.

## Decision Drivers

- Speed to a working demo is the top priority for M1
- Real Avalanche RPC integration is complex and error-prone
- The domain model and API contracts should be validated early
- e2e testing with tmpnet is not yet wired
- Contributors should be able to run the full stack without external dependencies

## Considered Options

1. Fixture-first: static/mock data throughout, real integrations in M2
2. Real data from day one: integrate Avalanche RPC and database immediately
3. Record-replay: capture real data once, replay in dev/test

## Decision Outcome

Chosen option: "Fixture-first", because it lets us ship a working end-to-end skeleton
in M1 without external dependencies. The domain types, API contracts, and UI components
are validated against realistic fixture data. Real integrations are explicitly deferred
to M2 (tracked in `docs/planning/backlog.md` and `work-items.yaml`).

### Consequences

**Good:**

- Fast iteration on domain model and API contracts
- Zero external dependencies for local development
- Clear separation between "shape of the system" (M1) and "real data" (M2)
- Reduces risk of M1 being blocked by infra issues

**Bad:**

- Fixture data may diverge from real Avalanche responses
- Some bugs will only surface when real data flows through
- Risk of fixture code becoming load-bearing if not replaced

**Neutral:**

- Backlog explicitly tracks every fixture-to-real transition

## Pros and Cons of the Options

### Fixture-first

- Good, because zero external dependencies
- Good, because fast to implement and demo
- Good, because validates types and contracts
- Bad, because fixture/real divergence risk

### Real data from day one

- Good, because no fixture/real divergence
- Bad, because requires Avalanche node access for every developer
- Bad, because database setup adds onboarding friction
- Bad, because integration bugs block M1 delivery

### Record-replay

- Good, because data is realistic
- Good, because no live dependency after recording
- Bad, because recording infrastructure is its own project
- Bad, because recordings go stale as APIs evolve

## More Information

- [Backlog of deferred items](../planning/backlog.md)
- [Work items](../planning/work-items.yaml)
- [Risk register](../planning/risk-register.md)
