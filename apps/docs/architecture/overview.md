# Architecture Overview

Warplane is a TypeScript + Go monorepo managed with pnpm workspaces.

## Package Map

| Package              | Role                      | Key Exports                                                     |
| -------------------- | ------------------------- | --------------------------------------------------------------- |
| `@warplane/domain`   | Core types and validation | `ChainId`, `Subnet`, `HealthStatus`, `ChainStatus`, `chainId()` |
| `@warplane/storage`  | Persistence interfaces    | `ChainStatusReader`, `ChainStatusWriter`, `ChainStatusStore`    |
| `@warplane/ingest`   | Data ingestion pipeline   | `pollChainHealth()`                                             |
| `@warplane/api`      | Fastify REST server       | `/healthz`, `/api/v1/chains`                                    |
| `@warplane/web`      | React + Vite dashboard    | Browser app                                                     |
| `@warplane/cli`      | Command-line tool         | `warplane ping`                                                 |
| `@warplane/docs-mcp` | MCP server for docs       | Stdio-based MCP resources, tools, prompts                       |
| `harness/tmpnet`     | Go test harness           | tmpnet integration for e2e                                      |

## Dependency Graph

```
@warplane/api ──► @warplane/domain
@warplane/storage ──► @warplane/domain
@warplane/ingest ──► @warplane/domain
@warplane/cli ──► @warplane/domain
```

The web app and docs site have no internal workspace dependencies. The MCP server reads docs from the filesystem at runtime.

## Design Decisions

Key architectural choices are recorded as ADRs:

- [ADR-0001](/decisions/0001-use-structured-madr): Structured MADR format
- [ADR-0002](/decisions/0002-use-monorepo-with-ts-and-go): Monorepo with TypeScript + Go
- [ADR-0003](/decisions/0003-fixture-first-day1-mvp): Fixture-first approach for Day-1 MVP

## Build Pipeline

```bash
make build    # Build all TS packages + Go harness
make test     # Run vitest + Go tests
make check    # ESLint + tsc -b
```

TypeScript uses composite project references. Each package compiles independently with `tsc -b` and outputs to its own `dist/` directory.
