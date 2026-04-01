# ADR-0002: Use Monorepo with TypeScript and Go

## Status

Accepted (2026-04-01)

## Context

Warplane spans a web dashboard, REST API, CLI, domain logic, data ingestion, storage, documentation, and a Go-based test harness. We need to decide on repository structure and language choices.

## Decision

Monorepo with pnpm workspaces for TypeScript packages and a Go module in `harness/tmpnet`. This gives shared types via workspace protocol, a single CI pipeline, and atomic cross-package changes.

## Consequences

- Atomic changes across domain, API, web, and CLI
- Single `make build` / `make test` for everything
- Two language toolchains (Node + Go) required for full builds

Source: `docs/decisions/0002-use-monorepo-with-ts-and-go.md`
