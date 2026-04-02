# Milestone 1 -- Status

Last updated: 2026-04-01

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

## Backlog (deferred to M2+)

See [`backlog.md`](backlog.md) and [`work-items.yaml`](work-items.yaml) for full details.

- Real Avalanche RPC polling
- Docker Compose
- Full E2E test wiring with live tmpnet
- Postgres storage adapter option

## Links

- [Roadmap](roadmap.md)
- [Work items](work-items.yaml)
- [Risk register](risk-register.md)
- [Decision log](../decisions/README.md)
- [Product one-pager](../product/one-pager.md)
- [Milestone 1 report](milestone-1-report.md)
