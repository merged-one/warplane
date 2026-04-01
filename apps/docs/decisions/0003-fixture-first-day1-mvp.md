# ADR-0003: Fixture-First Approach for Day-1 MVP

## Status

Accepted (2026-04-01)

## Context

Milestone 1 aims to ship a working monorepo skeleton quickly. Integrating with real Avalanche nodes and databases adds significant complexity and risk for the MVP.

## Decision

Fixture-first: use static/mock data throughout M1, defer real integrations to M2. The domain types, API contracts, and UI are validated against realistic fixture data.

## Consequences

- Fast iteration, zero external dependencies for local dev
- Clear separation between system shape (M1) and real data (M2)
- Fixture data may diverge from real Avalanche responses

Source: `docs/decisions/0003-fixture-first-day1-mvp.md`
