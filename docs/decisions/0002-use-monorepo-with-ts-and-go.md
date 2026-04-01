# ADR-0002: Use Monorepo with TypeScript and Go

## Status

Accepted

## Date

2026-04-01

## Context and Problem Statement

Warplane spans multiple concerns: a web dashboard, a REST API, a CLI, domain logic,
data ingestion, storage, documentation, and a Go-based test harness for Avalanche's
tmpnet. We need to decide on repository structure and language choices.

## Decision Drivers

- Minimize context-switching between repos for related changes
- TypeScript is the team's primary language for application code
- Go is required for tmpnet integration (Avalanche SDK is Go-native)
- Shared types between API, web, CLI, and ingest must stay in sync
- Build and test must be fast and CI-friendly

## Considered Options

1. Monorepo with pnpm workspaces (TS) + Go module (harness)
2. Polyrepo -- separate repos per package/app
3. Monorepo with Nx or Turborepo
4. All-Go monorepo

## Decision Outcome

Chosen option: "Monorepo with pnpm workspaces + Go module", because it gives us
shared TypeScript types via workspace protocol, a single CI pipeline, atomic
cross-package changes, and the Go harness lives cleanly in `harness/tmpnet` with
its own `go.mod`.

### Consequences

**Good:**

- Atomic changes across domain, API, web, and CLI
- Single `make build` / `make test` for everything
- pnpm workspaces handle TS dependency graph efficiently
- Go module is self-contained and doesn't interfere with Node tooling

**Bad:**

- Two language toolchains (Node + Go) required for full builds
- Monorepo scale issues if the project grows very large
- Go module in a subdirectory is slightly non-standard

**Neutral:**

- Makefile serves as the glue between Node and Go build systems

## Pros and Cons of the Options

### Monorepo with pnpm workspaces + Go module

- Good, because shared types stay in sync automatically
- Good, because single CI pipeline
- Good, because pnpm is fast and handles workspaces well
- Bad, because dual toolchain requirement

### Polyrepo

- Good, because each repo has independent CI and versioning
- Bad, because cross-repo type changes require coordinated releases
- Bad, because developer context-switching between repos

### Monorepo with Nx or Turborepo

- Good, because advanced caching and task orchestration
- Bad, because additional tooling complexity for a small team
- Bad, because Nx/Turborepo don't natively handle Go

### All-Go monorepo

- Good, because single toolchain
- Bad, because Go is not ideal for web dashboards and docs sites
- Bad, because the team's primary expertise is TypeScript

## More Information

- [pnpm workspaces](https://pnpm.io/workspaces)
- [Go modules in subdirectories](https://go.dev/ref/mod)
