# Milestone Status

Last updated: 2026-04-02

## Summary

Milestone 1 is complete. All planned deliverables have been implemented, tested, and documented.

## Monorepo skeleton

- [x] `pnpm install` works
- [x] `pnpm build` works
- [x] `pnpm test` works
- [x] `go test ./...` works in `harness/tmpnet`
- [x] Typecheck passes (`tsc -b`)
- [x] README documents value proposition, quickstart, and repo layout

## Domain model

- [x] Core types: ChainId, Subnet, HealthStatus, ChainStatus
- [x] Canonical domain schemas (Zod v4): MessageTrace, MessageEvent, NetworkManifest, ScenarioRun, registry types
- [x] Discriminated union for 11 event kinds
- [x] JSON Schema generation (`packages/domain/generated/*.schema.json`)
- [x] OpenAPI 3.1 component bundle (`packages/domain/generated/openapi-components.json`)
- [x] Golden fixture validation (all 8 traces, 5 scenarios, network manifest)
- [x] Trace model runbook (`docs/runbooks/trace-model.md`)

## Storage

- [x] SQLite persistence layer with better-sqlite3
- [x] Migration system with numbered SQL files
- [x] Repository pattern for traces, chains, networks, scenarios, artifacts, imports
- [x] Idempotent upserts and import history tracking

## Ingestion

- [x] Artifact import pipeline with Zod schema validation
- [x] Watch mode for local development
- [x] CLI and programmatic API

## API

- [x] Fastify server with `/healthz`
- [x] Full route layer: chains, traces, scenarios, network, failures, search, import
- [x] OpenAPI 3.1 spec auto-generated with Swagger UI
- [x] Demo mode auto-seeding from golden fixtures

## Web dashboard

- [x] React + Vite app with trace explorer
- [x] Pages: overview, traces list, trace detail, failures, scenarios, docs
- [x] Status badges, event timeline, raw JSON toggle
- [x] Demo banner for seeded mode

## CLI

- [x] Full command suite: doctor, demo, traces, failures, scenarios, registry, import, docs
- [x] JSON output mode for scripting
- [x] Shell completion (bash, zsh, fish)
- [x] API client with configurable endpoint

## Docs

- [x] VitePress site with full navigation
- [x] Architecture overview, trace model, trace glossary, domain types
- [x] Community value page
- [x] Troubleshooting page for seeded and E2E modes

## Harness

- [x] Go tmpnet module with Ginkgo/Gomega E2E suite
- [x] 5 deterministic Teleporter scenarios
- [x] Golden fixture generator (no binaries needed)
- [x] Artifact management and trace/event types
- [x] Compile-only check target (`make e2e-compile`)
- [x] Full E2E target (`make e2e`, requires AvalancheGo)

## CI / Scripts

- [x] `demo:seed` script (API + web with seeded fixtures)
- [x] GitHub Actions CI workflow (build, lint, typecheck, format, tests, API integration, CLI smoke, docs, llms, ADR validation)
- [x] GitHub Actions Go harness job (build, vet, test — parallel)
- [x] GitHub Actions E2E tmpnet workflow (manual dispatch)
- [x] `repo:check` / `make repo-check` — full local CI check suite
- [x] Pre-commit hook (typecheck + lint + format)

## Planning and tracking

- [x] Product one-pager
- [x] Roadmap with milestone breakdown
- [x] Machine-readable work items
- [x] Risk register
- [x] Decision index
- [x] Working agreement
- [x] Milestone 1 report

## Architecture decisions

- [x] ADR system with Structured MADR template
- [x] ADR-0001: Use Structured MADR
- [x] ADR-0002: Use monorepo with TypeScript and Go
- [x] ADR-0003: Fixture-first approach for MVP
- [x] ADR-0004: Zod as single schema source
- [x] `new-adr.mjs` scaffolding script
- [x] ADR validation CI workflow

## GitHub contribution flow

- [x] Issue templates: feature, bug, task (YAML forms)
- [x] PR template with checklist
- [x] Label definitions and sync script

## Repo governance

- [x] CODEOWNERS, SECURITY.md, RELEASE.md, CONTRIBUTING.md

## Documentation system

- [x] VitePress docs site with full navigation
- [x] AI docs section with AGENTS.md, prompting guide, repo map, MCP usage
- [x] `llms.txt` and `llms-full.txt` generated deterministically
- [x] MCP docs server with resources, prompts, and tools
- [x] `docs/ai/context-map.json` machine-readable file index

## Backlog (deferred to later M2 stages)

See [`backlog.md`](backlog.md) and [`work-items.yaml`](work-items.yaml) for full details.

- ~~Real Avalanche RPC polling~~ → Done (Stage 1)
- Docker Compose → Planned (Stage 7)
- ~~Full E2E test wiring with live tmpnet~~ → Partially done (Stage 8)
- ~~Postgres storage adapter option~~ → Done (Stage 4)

---

## Milestone 2 -- Status (In Progress)

### Summary

Milestone 2 Stages 1–5 of 8 are complete. The ingestion pipeline, event normalization,
Prometheus metrics integration, storage evolution, and tracing UI / relayer ops dashboard
are all shipped. Remaining work: webhooks, Docker Compose, Fuji deployment, and E2E hardening.

### Stage 1: RPC Ingestion Engine (Complete)

- [x] `eth_getLogs` polling with configurable block range and backfill
- [x] WebSocket `newHeads` subscription for real-time block tracking
- [x] Block tracker with reorg-aware cursor management
- [x] Log fetcher with rate limiting and retry logic
- [x] Event decoder for all 8 TeleporterMessenger contract events
- [x] Orchestrator coordinating block tracker, fetcher, and decoder
- [x] Checkpoint persistence for ingestion state recovery
- [x] 113 tests passing

### Stage 2: Event Normalization & Correlation (Complete)

- [x] Normalizer: raw EVM logs → canonical 11-kind MessageEvent objects
- [x] Correlator: cross-chain message state machine (source + destination matching)
- [x] Scenario classifier: auto-detect scenario type from event sequences
- [x] Pipeline coordinator: connects ingest stages with storage writes
- [x] ADR-0006 event model alignment verified

### Stage 3: Prometheus Metrics Integration (Complete)

- [x] Generic Prometheus scraper with configurable endpoints
- [x] Prometheus text format parser (counters, gauges, histograms, summaries)
- [x] Relayer metrics: 15 metrics → RelayerHealthSnapshot (success rate, latency, lag, failures)
- [x] Sig-agg metrics: 11 metrics → SigAggHealthSnapshot (aggregation latency, stake weight, cache hit rate)
- [x] ADR-0008 Prometheus-based off-chain event correlation

### Stage 4: Storage Evolution & Postgres (Complete)

- [x] Async `DatabaseAdapter` interface for storage abstraction
- [x] `createSqliteAdapter` wrapping sync better-sqlite3 calls
- [x] Health snapshot repos: `relayer-health.ts`, `sigagg-health.ts`
- [x] Webhook repos: `webhooks.ts` with delivery tracking
- [x] Checkpoint repos: `checkpoints.ts` for ingestion cursors
- [x] New migration: `003_health_snapshots.sql` (4 new tables)
- [x] ADR-0009 dual-mode storage with Postgres adapter

### Stage 5: Tracing UI & Relayer Ops Dashboard (Complete)

- [x] Per-message lifecycle timeline with on-chain (●) vs off-chain (○) distinction
- [x] Enhanced trace list with status filter chips, chain filter, latency column
- [x] Relayer ops dashboard: health overview, failure chart, latency percentiles, sparkline
- [x] Signature aggregator panel with stake weight bars per subnet
- [x] API endpoints: relayer health, sig-agg health, stats/failures, stats/latency, pipeline status
- [x] Pure CSS/SVG charting (zero external dependencies)
- [x] Auto-refresh for pending traces (5s interval)
- [x] 413 total tests passing (403 backend + 10 web)

### Stage 6: Alerting & Webhooks (Planned)

- [ ] Webhook subscription management API
- [ ] At-least-once delivery with HMAC verification
- [ ] Exponential backoff and dead-letter queue
- [ ] Alert rules for failed, delayed, and stuck messages

### Stage 7: Docker Compose & Fuji Deployment (Planned)

- [ ] Docker Compose for self-hosted deployment
- [ ] Fuji-compatible deployment guide and configuration

### Stage 8: E2E Testing & Hardening (Planned)

- [ ] Real tmpnet E2E integration wiring
- [ ] Load testing and performance benchmarks

### Test counts

| Package   | Tests   |
| --------- | ------- |
| domain    | 31      |
| storage   | 85      |
| ingest    | 277     |
| api       | 10      |
| web       | 10      |
| **Total** | **413** |

### Architecture Decisions (M2)

- [x] ADR-0005: RPC-first multi-source ingestion
- [x] ADR-0006: Event model aligned to TeleporterMessenger contracts
- [x] ADR-0007: Four-milestone grant delivery
- [x] ADR-0008: Prometheus-based off-chain event correlation
- [x] ADR-0009: Dual-mode storage with Postgres adapter

## Links

- [Roadmap](roadmap.md)
- [Work items](work-items.yaml)
- [Risk register](risk-register.md)
- [Decision log](../decisions/README.md)
- [Product one-pager](../product/one-pager.md)
- [Milestone 1 report](milestone-1-report.md)
- [Milestone 2 plan](milestone-2-plan.md)
