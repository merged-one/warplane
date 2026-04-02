---
outline: deep
---

# Roadmap

## Milestone 1 — Monorepo Skeleton & Day-1 MVP

**Goal:** Ship a working monorepo with domain types, API shell, web dashboard, docs site, Go test harness, and CI-ready pipelines.

**Status:** Complete — see [Status](/planning/status)

| #   | Deliverable           | Package             | Status |
| --- | --------------------- | ------------------- | ------ |
| 1   | Core domain types     | `packages/domain`   | Done   |
| 2   | Storage interfaces    | `packages/storage`  | Done   |
| 3   | Ingest pipeline stub  | `packages/ingest`   | Done   |
| 4   | Fastify API           | `apps/api`          | Done   |
| 5   | React dashboard shell | `apps/web`          | Done   |
| 6   | VitePress docs site   | `apps/docs`         | Done   |
| 7   | Go tmpnet harness     | `harness/tmpnet`    | Done   |
| 8   | CLI with `ping`       | `packages/cli`      | Done   |
| 9   | Build pipelines       | root config         | Done   |
| 10  | Planning & governance | `docs/`, `.github/` | Done   |

## Milestone 2 — Real Data & CI (planned)

- CI pipeline (GitHub Actions)
- Real Avalanche RPC polling
- SQLite/Postgres storage adapter
- Docker Compose local dev
- e2e test wiring with tmpnet

## Milestone 3 — Operations & Observability (planned)

- CLI commands: status, deploy, logs, config
- Web dashboard data fetching and state management
- Alerting and notification system
- Metrics and observability

## Links

- [Work items](https://github.com/warplane) (tracked in `docs/planning/work-items.yaml`)
- [Risk register](/planning/risk-register)
- [Decision log](/decisions/)
