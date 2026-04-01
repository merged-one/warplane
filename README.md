# Warplane

**Interchain Control Plane for Avalanche L1s**

Observe, manage, and orchestrate Avalanche L1 subnets from a single pane of glass.

## Repo layout

```
apps/
  api/          Fastify API server — chain status, lifecycle operations
  web/          React + Vite dashboard
  docs/         VitePress documentation site
packages/
  domain/       Core types and domain logic (ChainId, Subnet, HealthStatus)
  storage/      Persistence interfaces for chain state and metrics
  ingest/       Data ingestion pipeline — polls Avalanche nodes
  cli/          CLI tool for managing and monitoring L1s
  docs-mcp/     MCP server exposing docs for LLM consumption
harness/
  tmpnet/       Go harness for spinning up temporary Avalanche networks (e2e)
docs/
  planning/     Milestone checklists, backlog, and status tracking
scripts/        Build, demo, and AI helper scripts
```

## Milestone 1 goal

Ship a working monorepo skeleton with:
- Domain types modelling Avalanche L1 chains and subnets
- A Fastify API with `/healthz` and `/api/v1/chains`
- A React dashboard shell
- A VitePress docs site
- A Go test harness for tmpnet integration
- CI-ready build, test, and lint pipelines

## Quick start

```bash
# Prerequisites: Node >= 20, pnpm >= 10, Go >= 1.22
make bootstrap   # install all deps
make build        # build everything
make test         # run all tests
make check        # lint + typecheck
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start the API server in dev mode |
| `pnpm demo:day1` | Run the Milestone 1 demo |
| `pnpm docs:llms` | Bundle docs for LLM consumption |
| `pnpm ai:pack` | Generate AI context pack |
| `pnpm mcp:docs` | Start the docs MCP server |

## License

Apache-2.0 — see [LICENSE](LICENSE).
