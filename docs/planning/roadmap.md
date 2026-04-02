# Warplane Roadmap

## Milestone 1 -- Monorepo Skeleton & Day-1 MVP

**Goal:** Ship a working monorepo with domain types, API shell, web dashboard, docs site,
Go test harness, and CI-ready pipelines.

**Status:** In progress -- see [status.md](status.md)

### Deliverables

| #   | Deliverable                                | Package(s)          | Status      |
| --- | ------------------------------------------ | ------------------- | ----------- |
| 1   | Core domain types                          | `packages/domain`   | Done        |
| 2   | Storage interfaces                         | `packages/storage`  | Done        |
| 3   | Ingest pipeline stub                       | `packages/ingest`   | Done        |
| 4   | Fastify API (`/healthz`, `/api/v1/chains`) | `apps/api`          | Done        |
| 5   | React dashboard shell                      | `apps/web`          | Done        |
| 6   | VitePress docs site                        | `apps/docs`         | Done        |
| 7   | Go tmpnet harness                          | `harness/tmpnet`    | Done        |
| 8   | CLI with `ping` command                    | `packages/cli`      | Done        |
| 9   | Build, test, lint pipelines                | root config         | Done        |
| 10  | Planning, ADR, and governance system       | `docs/`, `.github/` | In progress |

### Key dates

| Event                         | Target             |
| ----------------------------- | ------------------ |
| M1 code complete              | Week of 2026-03-31 |
| M1 governance & docs complete | Week of 2026-04-07 |
| M1 demo                       | TBD                |

## Milestone 2 -- Real Data & CI (planned)

- CI pipeline (GitHub Actions) for lint, test, build
- Real Avalanche RPC polling in `@warplane/ingest`
- SQLite/Postgres storage adapter
- Docker Compose for local dev
- e2e test wiring with tmpnet

## Milestone 3 -- Operations & Observability (planned)

- CLI commands: status, deploy, logs, config
- Web dashboard data fetching and state management
- MCP docs server with MCP SDK
- Alerting and notification system
- Metrics and observability

## Links

- [Work items (machine-readable)](work-items.yaml)
- [Risk register](risk-register.md)
- [Decision log](../decisions/README.md)
- [Product one-pager](../product/one-pager.md)
