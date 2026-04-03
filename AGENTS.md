# AGENTS.md — Warplane

> Conventions and context for coding agents working in this repo.

## What is Warplane?

An interchain control plane for Avalanche L1s. TypeScript + Go monorepo providing unified observability, lifecycle management, and cross-chain orchestration for subnet operators.

## Repo Structure

```
apps/
  api/          Fastify REST API server (@warplane/api)
  web/          React + Vite dashboard (@warplane/web)
  docs/         VitePress documentation site (@warplane/docs-site)
packages/
  domain/       Core types: ChainId, Subnet, HealthStatus, ChainStatus, MessageTrace (@warplane/domain)
  storage/      SQLite + Postgres persistence with DatabaseAdapter (@warplane/storage)
  ingest/       RPC, WebSocket, and Prometheus ingestion pipeline (@warplane/ingest)
  cli/          CLI tool (@warplane/cli)
  docs-mcp/     MCP server for docs (@warplane/docs-mcp)
harness/
  tmpnet/       Go test harness for Avalanche tmpnet
docs/
  planning/     Roadmap, status, work-items.yaml, backlog, risk-register
  decisions/    Architecture Decision Records (MADR format)
  product/      Product one-pager
  ai/           AI-facing docs, context map, prompting guide
scripts/        Build, demo, and generation scripts
```

## Key Commands

| Command             | Purpose                                            |
| ------------------- | -------------------------------------------------- |
| `make bootstrap`    | Install all dependencies (pnpm + Go)               |
| `make build`        | Build all packages                                 |
| `make test`         | Run all tests (vitest + Go)                        |
| `make check`        | Lint + typecheck                                   |
| `pnpm dev`          | Start API server in dev mode                       |
| `pnpm demo:seed`    | Run seeded demo (golden fixtures)                  |
| `pnpm docs:dev`     | Start docs site dev server                         |
| `pnpm docs:build`   | Build docs site                                    |
| `pnpm docs:llms`    | Generate llms.txt, llms-full.txt, context-map.json |
| `pnpm ai:pack`      | Generate full AI context bundle (source + docs)    |
| `pnpm ai:pack:docs` | Generate docs-only AI context bundle               |
| `pnpm mcp:docs`     | Start docs MCP server (stdio)                      |

## CLI (`warplane`)

The `warplane` CLI provides terminal access to all MVP data. Build with `pnpm -F @warplane/cli build`.

**Useful for agents:**

```bash
# Check environment readiness
warplane doctor
warplane --json doctor | jq '.ok'

# Query traces (supports --json for machine parsing)
warplane --json traces list
warplane --json traces list --scenario basic_send_receive --status success
warplane --json traces show <messageId>

# Inspect failures
warplane --json failures list

# Query registry and scenarios
warplane --json registry show
warplane --json scenarios list

# Import artifacts
warplane --json import harness/tmpnet/artifacts

# Use a different API instance
warplane --api-url http://localhost:8080 traces list
```

Always use `--json` when parsing output programmatically. The CLI talks to the local API by default (`http://localhost:3100`); set `WARPLANE_API_URL` to override.

See `docs/runbooks/cli.md` for the full reference.

## Quality Rules

Before any PR:

1. `pnpm build` must pass
2. `pnpm test` must pass
3. `pnpm run check` (lint + typecheck) must pass
4. New code should have tests
5. No placeholder TODOs without a backlog entry in `docs/planning/backlog.md`
6. Every package must have a `description` in its `package.json`

## TypeScript Conventions

- Strict mode everywhere (`"strict": true`)
- `readonly` for interface properties that shouldn't be mutated
- Explicit return types on exported functions
- No `any` — use `unknown` and narrow
- `node:` prefix for Node built-in imports
- `workspace:*` protocol for internal dependencies
- Composite project references (`tsc -b`)

## Go Conventions

- Standard `gofmt` and `go vet`
- `_test.go` suffix for test files
- The harness wraps tmpnet only — no application logic

## Commit Messages

Imperative mood: `feat: Add chain polling`, not `feat: Added chain polling`.

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`

## ADRs

Non-trivial architecture decisions get an ADR:

```bash
node scripts/new-adr.mjs "Title of decision"
```

ADRs live in `docs/decisions/` using Structured MADR format. They are validated in CI.

## Work Tracking

- `docs/planning/work-items.yaml` — machine-readable tasks
- `docs/planning/status.md` — milestone progress
- `docs/planning/backlog.md` — deferred items
- `docs/planning/risk-register.md` — known risks

## MCP Server

The docs MCP server (`@warplane/docs-mcp`) exposes documentation over stdio:

```bash
pnpm mcp:docs
```

See `packages/docs-mcp/README.md` for resources, prompts, and tools.

## AI Context

- `llms.txt` — LLM discovery file with sections and links (generated)
- `llms-full.txt` — full documentation content for LLM consumption (generated)
- `docs/ai/context-map.json` — machine-readable file index with priorities (generated)
- `docs/ai/prompting-guide.md` — effective prompt patterns for this repo
- `docs/ai/repo-map.md` — machine-friendly repo structure map
- `docs/ai/mcp-usage.md` — MCP server setup and usage guide
- `docs/ai/repomix.md` — Repomix context packing documentation
- `repomix.config.json` — full bundle config (source + docs)
- `repomix-docs.config.json` — docs-only bundle config

## Current State

- **Milestone 1** is complete (monorepo skeleton, domain types, API, web dashboard, CLI, docs, Go harness, CI)
- **Milestone 2** Stages 1–5 of 8 are complete:
  - Stage 1: RPC ingestion engine (block tracker, log fetcher, event decoder, orchestrator)
  - Stage 2: Event normalization pipeline (normalizer, correlator, state machine per message)
  - Stage 3: Prometheus metrics integration (relayer health, sig-agg health, scraper)
  - Stage 4: Storage evolution (async DatabaseAdapter, Postgres adapter, health/webhook repos)
  - Stage 5: Tracing UI (lifecycle timeline, relayer ops dashboard, stats API endpoints)
- Remaining M2 work: Stage 6 (webhooks), Stage 7 (Docker + Fuji), Stage 8 (E2E hardening)
- CI pipeline runs on push to main and PRs
- See `docs/planning/status.md` for full details

## Architecture Patterns (M2)

### Sync/Async Database Bridge

The API server uses both patterns:

- **Sync `app.db`** (better-sqlite3 `Database`) — traces, chains, scenarios, search
- **Async `app.asyncDb`** (`DatabaseAdapter` via `createSqliteAdapter`) — health repos, webhooks

Both wrap the same underlying SQLite connection. New async repos (`relayer-health.ts`, `sigagg-health.ts`, `webhooks.ts`) use `DatabaseAdapter` for Postgres compatibility.

### Ingestion Pipeline

```
RPC Provider → BlockTracker → LogFetcher → EventDecoder → Normalizer → Correlator → Storage
                                                                        ↑
Prometheus Scraper → RelayerMetrics / SigAggMetrics ─────────────────────┘
```

### Web Dashboard Pages

| Route         | Component       | Data Sources                           |
| ------------- | --------------- | -------------------------------------- |
| `/`           | OverviewPage    | Health, traces, scenarios              |
| `/traces`     | TracesPage      | Traces (filtered, paginated)           |
| `/traces/:id` | TraceDetailPage | Single trace + events timeline         |
| `/failures`   | FailuresPage    | Failed/blocked traces                  |
| `/scenarios`  | ScenariosPage   | Scenario runs                          |
| `/relayer`    | RelayerOpsPage  | Relayer health, failure stats, latency |
| `/docs`       | DocsPage        | Embedded documentation                 |

### UI Component Patterns

- **No charting library** — pure CSS bars + inline SVG sparklines (zero external deps)
- **On-chain vs off-chain events** — classified by event kind; visual distinction via filled (●) vs hollow (○) dots
- **Auto-refresh** — `useFetch` hook with interval for pending traces (5s) and dashboard panels
