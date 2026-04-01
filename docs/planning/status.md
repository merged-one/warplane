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
- [x] Ginkgo/Gomega E2E suite with RUN_E2E gate
- [x] L1TestInfo and NetworkInfo types in pkg/harness
- [x] CreateNetworkWithTeleporter helper (scaffold — real tmpnet wiring in M2)
- [x] Artifact management: writes `artifacts/network/network.json`
- [x] Unit tests for types, URL builders, and artifact round-trip
- [x] `make e2e-compile` target for compile-only checks
- [x] `make e2e` target for full E2E runs
- [x] `docs/runbooks/full-e2e.md` with prerequisites and fallback story
- [x] `harness/tmpnet/README.md` with structure and env vars

## CI / Scripts

- [x] `demo:day1` script
- [x] `docs:llms` script
- [x] `ai:pack` script
- [x] Makefile with bootstrap, build, test, check, e2e-compile, e2e targets

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

## Documentation system

- [x] VitePress docs site with full navigation (Product, Architecture, Planning, ADRs, API, CLI, Runbooks, AI)
- [x] AI docs section in VitePress with agents-md, prompting-guide, repo-map, MCP, repomix, llms-txt pages
- [x] `llms.txt` and `llms-full.txt` generated deterministically from docs structure
- [x] `docs/ai/context-map.json` machine-readable file index (deterministic, no date field)
- [x] `scripts/generate-llms.mjs` deterministic generation script
- [x] MCP docs server (`@warplane/docs-mcp`) with resources, prompts, and tools
- [x] `AGENTS.md` with repo conventions for coding agents
- [x] `docs/ai/` directory with prompting guide, repo map, MCP usage, repomix guide
- [x] `repomix.config.json` (full) and `repomix-docs.config.json` (docs-only)
- [x] `ai:pack` and `ai:pack:docs` scripts with repomix config support

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
