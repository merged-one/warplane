# Repo Map

Machine-friendly map of the Warplane repository structure.

## Packages

### apps/api — @warplane/api

- **Role:** Fastify REST API server with OpenAPI 3.1
- **Entry:** `src/index.ts`
- **App builder:** `src/app.ts` (creates Fastify instance, decorates with `db` and `asyncDb`)
- **Routes:**
  - `src/routes/traces.ts` — `/api/v1/traces`, `/api/v1/traces/:id`, `/api/v1/traces/:id/timeline`, `/api/v1/traces/:id/raw`
  - `src/routes/chains.ts` — `/api/v1/chains`
  - `src/routes/network.ts` — `/api/v1/network`
  - `src/routes/scenarios.ts` — `/api/v1/scenarios`
  - `src/routes/failures.ts` — `/api/v1/failures`
  - `src/routes/search.ts` — `/api/v1/search`
  - `src/routes/import.ts` — `/api/v1/import`, `/api/v1/imports`
  - `src/routes/relayer.ts` — `/api/v1/relayer/health`, `/api/v1/relayer/health/history`
  - `src/routes/sigagg.ts` — `/api/v1/sigagg/health`, `/api/v1/sigagg/health/history`
  - `src/routes/stats.ts` — `/api/v1/stats/failures`, `/api/v1/stats/latency`
  - `src/routes/pipeline.ts` — `/api/v1/pipeline/status`
- **Depends on:** `@warplane/domain`, `@warplane/storage`, `@warplane/ingest`
- **Test:** `src/index.test.ts`

### apps/web — @warplane/web

- **Role:** React + Vite dashboard with relayer ops
- **Entry:** `src/main.tsx`
- **Router:** `src/App.tsx` (React Router with layout)
- **Pages:**
  - `src/pages/OverviewPage.tsx` — Dashboard overview
  - `src/pages/TracesPage.tsx` — Trace list with status filter chips, chain filter, latency column
  - `src/pages/TraceDetailPage.tsx` — Per-message lifecycle timeline with auto-refresh
  - `src/pages/FailuresPage.tsx` — Failed/blocked traces
  - `src/pages/ScenariosPage.tsx` — Scenario runs
  - `src/pages/RelayerOpsPage.tsx` — Relayer health, failure classification, delivery latency
  - `src/pages/DocsPage.tsx` — Embedded documentation
- **Key components:**
  - `src/components/EventTimeline.tsx` — Vertical timeline with on-chain/off-chain distinction
  - `src/components/HealthBadge.tsx` — Health status indicator (healthy/degraded/unhealthy)
  - `src/components/FailureChart.tsx` — Pure CSS horizontal bar chart
  - `src/components/LatencySparkline.tsx` — Inline SVG polyline sparkline
  - `src/components/StakeWeightBar.tsx` — Percentage bar for stake weight
  - `src/components/StatusBadge.tsx` — Execution status badge
  - `src/components/EventBadge.tsx` — Event kind badge
  - `src/components/Layout.tsx` — Navigation layout with sidebar
- **API client:** `src/api.ts` — typed fetch functions for all endpoints
- **Hooks:** `src/hooks.tsx` — `useFetch` (data fetching + auto-refresh), `useFormatTime`
- **Build:** Vite (not tsc)

### apps/docs — @warplane/docs-site

- **Role:** VitePress documentation site
- **Config:** `.vitepress/config.ts`
- **Home:** `index.md`
- **Build:** VitePress

### packages/domain — @warplane/domain

- **Role:** Core domain types and Zod validation schemas
- **Entry:** `src/index.ts`
- **Exports:** `MessageTrace`, `MessageEvent`, `NetworkManifest`, `ScenarioRun`, `ChainRegistryEntry`, event kind discriminated union (11 kinds)
- **Generated:** `generated/*.schema.json`, `generated/openapi-components.json`
- **Test:** `src/index.test.ts`

### packages/storage — @warplane/storage

- **Role:** SQLite + async DatabaseAdapter persistence layer
- **Entry:** `src/index.ts`
- **Key modules:**
  - `src/db.ts` — SQLite connection management (better-sqlite3)
  - `src/migrate.ts` — Migration runner
  - `src/adapter.ts` — `DatabaseAdapter` interface + `createSqliteAdapter`
  - `src/repos/traces.ts` — Trace CRUD + `getFailureClassification`, `getDeliveryLatencyStats`
  - `src/repos/relayer-health.ts` — Relayer health snapshots (async)
  - `src/repos/sigagg-health.ts` — Sig-agg health snapshots (async)
  - `src/repos/webhooks.ts` — Webhook subscriptions and delivery (async)
  - `src/repos/checkpoints.ts` — Ingestion cursor checkpoints (async)
- **Migrations:** `src/migrations/001_initial.sql`, `002_import_history.sql`, `003_health_snapshots.sql`
- **Depends on:** `@warplane/domain`
- **Tests:** `src/storage.test.ts`, `src/adapter.test.ts`, `src/repos/*.test.ts`

### packages/ingest — @warplane/ingest

- **Role:** Multi-source data ingestion pipeline
- **Entry:** `src/index.ts`
- **Key modules:**
  - `src/rpc/block-tracker.ts` — WebSocket + polling block head tracking
  - `src/rpc/fetcher.ts` — `eth_getLogs` with rate limiting and retries
  - `src/rpc/decoder.ts` — ABI decoding for 8 TeleporterMessenger events
  - `src/rpc/orchestrator.ts` — Coordinates tracker → fetcher → decoder pipeline
  - `src/pipeline/normalizer.ts` — Raw EVM logs → canonical MessageEvent
  - `src/pipeline/correlator.ts` — Cross-chain message state machine
  - `src/pipeline/scenarios.ts` — Auto-detect scenario type from event sequences
  - `src/pipeline/coordinator.ts` — End-to-end pipeline → storage integration
  - `src/metrics/prometheus-scraper.ts` — Generic Prometheus endpoint scraper
  - `src/metrics/prometheus-parser.ts` — Prometheus text format parser
  - `src/metrics/relayer-metrics.ts` — 15 relayer metrics → RelayerHealthSnapshot
  - `src/metrics/sigagg-metrics.ts` — 11 sig-agg metrics → SigAggHealthSnapshot
- **Depends on:** `@warplane/domain`, `@warplane/storage`
- **Tests:** `src/rpc/*.test.ts`, `src/pipeline/*.test.ts`, `src/metrics/*.test.ts`

### packages/cli — @warplane/cli

- **Role:** Command-line tool for trace inspection and ops
- **Entry:** `src/index.ts`
- **Commands:** `doctor`, `demo`, `traces`, `failures`, `scenarios`, `registry`, `import`, `docs`
- **Depends on:** `@warplane/domain`

### packages/docs-mcp — @warplane/docs-mcp

- **Role:** MCP server for documentation access
- **Entry:** `src/index.ts`
- **Transport:** stdio
- **Dependencies:** `@modelcontextprotocol/sdk`, `zod`

### harness/tmpnet

- **Role:** Go test harness for Avalanche tmpnet
- **Entry:** `main.go`
- **Test:** `main_test.go`
- **Language:** Go

## Documentation

| Path                                 | Content                                             |
| ------------------------------------ | --------------------------------------------------- |
| `docs/planning/roadmap.md`           | Milestone breakdown                                 |
| `docs/planning/status.md`            | Current progress (M1 + M2)                          |
| `docs/planning/milestone-2-plan.md`  | M2 staged implementation plan                       |
| `docs/planning/work-items.yaml`      | Machine-readable tasks                              |
| `docs/planning/backlog.md`           | Deferred items                                      |
| `docs/planning/risk-register.md`     | Known risks                                         |
| `docs/planning/working-agreement.md` | Coding standards                                    |
| `docs/decisions/*.md`                | Architecture Decision Records                       |
| `docs/product/one-pager.md`          | Product vision                                      |
| `docs/runbooks/`                     | Operational guides (API, CLI, storage, trace model) |
| `docs/ai/`                           | AI-facing docs and context map                      |

## Config Files

| File                  | Purpose                         |
| --------------------- | ------------------------------- |
| `package.json`        | Root workspace scripts and deps |
| `pnpm-workspace.yaml` | Workspace member globs          |
| `tsconfig.json`       | Root project references         |
| `tsconfig.base.json`  | Shared TS compiler options      |
| `vitest.config.ts`    | Test runner config              |
| `eslint.config.js`    | Linting rules                   |
| `prettier.config.js`  | Formatting rules                |
| `Makefile`            | Build orchestration (Node + Go) |
| `.editorconfig`       | Editor settings                 |
| `.nvmrc`              | Node version (20)               |

## Scripts

| Script                      | Purpose                           |
| --------------------------- | --------------------------------- |
| `scripts/demo-seed.sh`      | Seeded demo runner                |
| `scripts/generate-llms.mjs` | Generate llms.txt artifacts       |
| `scripts/docs-llms.sh`      | Shell wrapper for llms generation |
| `scripts/ai-pack.sh`        | AI context bundle generator       |
| `scripts/new-adr.mjs`       | ADR scaffolding                   |
| `scripts/sync-labels.mjs`   | GitHub label sync                 |
