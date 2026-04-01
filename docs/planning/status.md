# Milestone 1 -- Status

Last updated: 2026-04-01

## Summary

Milestone 1 delivers the monorepo skeleton, day-1 MVP code, and the planning/governance
system. All code deliverables are complete. Planning and governance artifacts are now in place.

## Monorepo skeleton

- [x] `pnpm install` works
- [x] `pnpm build` works
- [x] `pnpm test` works (3 tests, 2 files)
- [x] `go test ./...` works in `harness/tmpnet`
- [x] Typecheck passes (`tsc -b`)
- [x] README documents repo layout and M1 goal

## Domain model

- [x] Core types: ChainId, Subnet, HealthStatus, ChainStatus
- [x] Storage interfaces defined
- [x] Ingest pipeline stub

## API

- [x] Fastify server with `/healthz`
- [x] `/api/v1/chains` endpoint stub

## Web dashboard

- [x] React + Vite app shell

## Docs

- [x] VitePress site with intro page

## Harness

- [x] Go tmpnet module compiles and has smoke test

## CI / Scripts

- [x] `demo:day1` script
- [x] `docs:llms` script
- [x] `ai:pack` script
- [x] Makefile with bootstrap, build, test, check targets

## Planning and tracking

- [x] Product one-pager (`docs/product/one-pager.md`)
- [x] Roadmap with milestone breakdown (`docs/planning/roadmap.md`)
- [x] Machine-readable work items (`docs/planning/work-items.yaml`)
- [x] Risk register (`docs/planning/risk-register.md`)
- [x] Decision index (`docs/planning/decision-index.md`)
- [x] Working agreement (`docs/planning/working-agreement.md`)

## Architecture decisions

- [x] ADR system with Structured MADR template
- [x] ADR-0001: Use Structured MADR
- [x] ADR-0002: Use monorepo with TypeScript and Go
- [x] ADR-0003: Fixture-first approach for Day-1 MVP
- [x] `new-adr.mjs` scaffolding script
- [x] ADR validation CI workflow

## GitHub contribution flow

- [x] Issue templates: feature, bug, task (YAML forms)
- [x] PR template with checklist
- [x] Label definitions (`.github/labels.json`)
- [x] Label sync script (`scripts/sync-labels.mjs`)

## Repo governance

- [x] CODEOWNERS
- [x] SECURITY.md with disclosure process
- [x] RELEASE.md with versioning and release steps
- [x] CONTRIBUTING.md (existing, updated cross-links)

## Backlog (deferred to M2+)

See [`backlog.md`](backlog.md) and [`work-items.yaml`](work-items.yaml) for full details.

- CI pipeline (GitHub Actions)
- Real Avalanche RPC polling
- Storage implementations
- Docker Compose
- e2e test wiring

## Links

- [Roadmap](roadmap.md)
- [Work items](work-items.yaml)
- [Risk register](risk-register.md)
- [Decision log](../decisions/README.md)
- [Product one-pager](../product/one-pager.md)
