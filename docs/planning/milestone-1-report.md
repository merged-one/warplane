# Milestone 1 Report

## Scope Completed

Milestone 1 delivers a working MVP of the Interchain Control Plane for Avalanche L1s with the following capabilities:

### Core Infrastructure

- TypeScript + Go monorepo with pnpm workspaces and composite project references
- Zod v4 domain model generating TypeScript types, JSON Schema, and OpenAPI 3.1 specs
- SQLite storage layer with migrations, repository pattern, and idempotent upserts
- Artifact ingestion pipeline with schema validation and watch mode

### Observability Layer

- Canonical 11-event trace model for Teleporter message lifecycle
- 8 deterministic golden traces across 5 scenarios
- REST API with full query capabilities (traces, scenarios, chains, network, failures, search)
- Web dashboard with trace explorer, timeline visualization, and failure views
- CLI with JSON output for scripting

### Test Harness

- Go test harness with Ginkgo/Gomega for Avalanche tmpnet E2E testing
- 5 deterministic Teleporter scenarios (send/receive, fees, receipts, retry, replay)
- Golden fixture generator (no AvalancheGo binaries required)
- Compile-only and full E2E make targets

### Developer Experience

- One-command seeded demo (`pnpm demo:seed`)
- VitePress documentation site with architecture, runbooks, and ADRs
- AI documentation system (AGENTS.md, llms.txt, MCP server, context map)
- GitHub Actions CI with build, lint, test, integration smoke, docs validation
- Issue templates, PR template, labels, CODEOWNERS

## Verification Commands

```bash
# Install and build
pnpm install
pnpm build

# Type checking and linting
pnpm run check
pnpm format:check

# Unit tests
pnpm test

# Go harness
cd harness/tmpnet && go build ./... && go vet ./... && go test ./...

# Docs build
pnpm docs:build

# LLM artifact generation
pnpm docs:llms

# ADR validation
bash -c 'for f in docs/decisions/0*.md; do head -20 "$f"; done'

# Seeded demo smoke test
bash scripts/demo-seed.sh &
sleep 15
curl -sf http://localhost:3100/healthz
curl -sf http://localhost:3100/api/v1/traces | head -c 200
curl -sf http://localhost:3100/api/v1/scenarios | head -c 200
curl -sf http://localhost:3100/api/v1/network | head -c 200
curl -sf http://localhost:3100/openapi.json | head -c 200
kill %1

# CLI smoke test
npx warplane --help
npx warplane doctor

# Golden fixture verification
make golden-verify

# Full repo check
pnpm run repo:check
```

## Known Limitations

Listed in priority order (highest impact first):

1. **No live RPC ingestion** — All data comes from golden fixtures. Real Avalanche node polling is Milestone 2 scope.

2. **E2E tests require manual binary setup** — Full tmpnet E2E needs AvalancheGo and subnet-evm binaries built locally. The CI workflow for E2E is manual-dispatch only.

3. **No Docker Compose** — Local development requires Node, pnpm, and (optionally) Go installed directly. Containerized setup is Milestone 2.

4. **No live update mechanism** — The web dashboard requires manual refresh. WebSocket/SSE streaming is not yet implemented.

5. **SQLite only** — No Postgres adapter. Sufficient for local development and demos but not for production multi-user deployments.

6. **No authentication** — API and dashboard are unauthenticated. Suitable for local use only.

7. **No client-side routing fallback** — Production web builds need server-side SPA configuration for deep links.

8. **Search is basic** — Full-text search via API endpoint exists but is not exposed in the dashboard navigation.

## Immediate Next Steps (Milestone 2)

| Priority | Item                           | Rationale                                    |
| -------- | ------------------------------ | -------------------------------------------- |
| P0       | Real Avalanche RPC polling     | Core value — move from fixtures to live data |
| P0       | Full E2E tmpnet test wiring    | Validate against real Teleporter contracts   |
| P1       | Docker Compose                 | Lower setup barrier for contributors         |
| P1       | Postgres storage adapter       | Production-ready persistence option          |
| P2       | WebSocket/SSE for live updates | Real-time dashboard without polling          |
| P2       | Dashboard search integration   | Surface existing search API in the UI        |

See [roadmap.md](roadmap.md) and [backlog.md](backlog.md) for the full Milestone 2 plan.
