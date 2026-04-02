# Architecture Overview

Warplane is a TypeScript + Go monorepo for cross-chain message tracing on Avalanche L1s. It captures the full lifecycle of Teleporter messages and surfaces them through a REST API, web dashboard, and CLI.

## System Architecture

```
                                   ┌─────────────────┐
                                   │  Web Dashboard   │
                                   │  (React + Vite)  │
                                   └────────┬─────────┘
                                            │ fetch
┌──────────────────┐    ingest     ┌────────▼─────────┐    query     ┌──────────┐
│  Golden Fixtures │──────────────►│   Fastify API     │◄────────────│   CLI    │
│  (or live tmpnet)│               │   /api/v1/*       │             │ warplane │
└──────────────────┘               └────────┬─────────┘             └──────────┘
                                            │
                                   ┌────────▼─────────┐
                                   │   SQLite Storage  │
                                   │   (better-sqlite3)│
                                   └──────────────────┘
```

## Package Map

| Package              | Role                        | Key Exports                                                      |
| -------------------- | --------------------------- | ---------------------------------------------------------------- |
| `@warplane/domain`   | Core types and Zod schemas  | `MessageTrace`, `MessageEvent`, `ScenarioRun`, `NetworkManifest` |
| `@warplane/storage`  | SQLite persistence layer    | `openDb`, `listTraces`, `getTimeline`, `upsertTrace`             |
| `@warplane/ingest`   | Artifact ingestion pipeline | `importArtifacts()`, `startWatcher()`                            |
| `@warplane/api`      | Fastify REST server         | `/api/v1/traces`, `/api/v1/scenarios`, `/api/v1/network`, etc.   |
| `@warplane/web`      | React + Vite dashboard      | Trace explorer, scenario overview, failure viewer                |
| `@warplane/cli`      | Command-line tool           | `warplane traces`, `warplane doctor`, `warplane import`          |
| `@warplane/docs-mcp` | MCP server for docs         | Stdio-based MCP resources, tools, prompts                        |
| `harness/tmpnet`     | Go test harness             | 5 deterministic Teleporter scenarios, golden fixture generation  |

## Dependency Graph

```
@warplane/api ──► @warplane/ingest ──► @warplane/storage ──► @warplane/domain
@warplane/cli ──► @warplane/domain
@warplane/web (standalone — talks to API via HTTP)
@warplane/docs-mcp (standalone — reads docs from filesystem)
harness/tmpnet (Go — produces artifacts consumed by ingest)
```

## Data Flow

1. **Golden fixtures** (or live tmpnet runs) produce trace JSON files in `harness/tmpnet/artifacts/`
2. **Ingestion** validates artifacts against Zod schemas and writes to SQLite
3. **API** serves traces, scenarios, chains, and network data from SQLite
4. **Dashboard** and **CLI** query the API

## Schema System

Domain types are defined once in Zod v4 (`@warplane/domain`) and generate:

- TypeScript types (via `z.infer<>`)
- JSON Schema files (`packages/domain/generated/*.schema.json`)
- OpenAPI 3.1 component bundle (`packages/domain/generated/openapi-components.json`)
- Runtime validation for ingestion and API input

See [ADR-0004](/decisions/0004-zod-single-schema-approach) for the rationale.

## Design Decisions

Key architectural choices are recorded as ADRs:

- [ADR-0001](/decisions/0001-use-structured-madr): Structured MADR format
- [ADR-0002](/decisions/0002-use-monorepo-with-ts-and-go): Monorepo with TypeScript + Go
- [ADR-0003](/decisions/0003-fixture-first-day1-mvp): Fixture-first approach for MVP
- [ADR-0004](/decisions/0004-zod-single-schema-approach): Zod as single schema source

## Build Pipeline

```bash
make build    # Build all TS packages + Go harness
make test     # Run vitest + Go tests
make check    # ESLint + tsc -b
```

TypeScript uses composite project references. Each package compiles independently with `tsc -b` and outputs to its own `dist/` directory.
