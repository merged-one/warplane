# Warplane

**Interchain Control Plane for Avalanche L1s**

Observe, manage, and orchestrate Avalanche L1 subnets from a single pane of glass.

## Quick start — Day-1 Demo

Get a fully working MVP with seeded data in one command. No AvalancheGo binaries required.

```bash
# Prerequisites: Node >= 20, pnpm >= 10
git clone <repo-url> && cd warplane
pnpm install
pnpm demo:day1
```

This will build everything, start the API (with golden fixtures auto-seeded), and launch the web dashboard. You'll see:

- **Dashboard**: http://localhost:5173
- **API**: http://localhost:3100
- **Swagger UI**: http://localhost:3100/docs
- **Health**: http://localhost:3100/healthz

The demo uses 8 deterministic Teleporter traces and 5 scenarios generated from golden fixtures — no external services needed.

### Seeded mode vs. full tmpnet mode

|                 | Seeded (default)                               | Full tmpnet                                                |
| --------------- | ---------------------------------------------- | ---------------------------------------------------------- |
| **Setup**       | `pnpm demo:day1`                               | See [docs/runbooks/full-e2e.md](docs/runbooks/full-e2e.md) |
| **Requires**    | Node + pnpm                                    | Node + pnpm + Go + AvalancheGo + subnet-evm                |
| **Data source** | Golden fixtures in `harness/tmpnet/artifacts/` | Live Avalanche temporary network                           |
| **Use case**    | Development, demos, CI                         | Integration testing, pre-release validation                |

To switch from seeded to full tmpnet mode:

1. Install Go >= 1.22, AvalancheGo, and subnet-evm binaries
2. Run `make e2e` to execute the full E2E suite
3. Start the API with `DEMO_MODE=false pnpm dev` and ingest live artifacts with `pnpm ingest:watch`

## Repo health

Run the full CI check suite locally:

```bash
pnpm run repo:check    # or: make repo-check
```

This validates: build, lint, typecheck, format, tests, Go harness, docs build, llms generation, ADR structure, and doc links.

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
  planning/     Roadmap, work items, status, risk register
  product/      Product one-pager
  decisions/    Architecture Decision Records (MADR)
scripts/        Build, demo, and AI helper scripts
.github/        Issue templates, PR template, CI workflows
```

## Scripts

| Command               | Description                                         |
| --------------------- | --------------------------------------------------- |
| `pnpm demo:day1`      | Start API + web with seeded golden fixtures         |
| `pnpm run repo:check` | Full CI check suite (build, lint, test, docs, ADRs) |
| `pnpm dev`            | Start the API server in dev mode                    |
| `pnpm dev:web`        | Start the web dashboard in dev mode                 |
| `pnpm build`          | Build all packages                                  |
| `pnpm test`           | Run all unit tests                                  |
| `pnpm run check`      | Lint + typecheck                                    |
| `pnpm docs:dev`       | Start docs site locally                             |
| `pnpm docs:build`     | Build static docs site                              |
| `pnpm docs:llms`      | Generate llms.txt and LLM context files             |
| `pnpm ai:pack`        | Generate AI context bundle                          |
| `pnpm mcp:docs`       | Start the docs MCP server                           |
| `make repo-check`     | Same as `pnpm run repo:check`                       |
| `make e2e`            | Full E2E with real tmpnet (requires AvalancheGo)    |

## CI

CI runs automatically on push to `main` and on pull requests:

- **[CI](.github/workflows/ci.yml)**: Build, lint, typecheck, format, unit tests, API integration smoke test, CLI smoke test, docs build, llms generation check, ADR validation
- **[Go Harness](.github/workflows/ci.yml)**: Go build, vet, and unit tests (parallel with main CI)
- **[E2E Tmpnet](.github/workflows/e2e-tmpnet.yml)**: Full tmpnet E2E (manual dispatch only — requires AvalancheGo binaries)
- **[ADR Validation](.github/workflows/adr-validation.yml)**: Validates ADR structure on changes to `docs/decisions/`

## Planning and governance

| Document                                                | Purpose                          |
| ------------------------------------------------------- | -------------------------------- |
| [Product one-pager](docs/product/one-pager.md)          | What Warplane is and why         |
| [Roadmap](docs/planning/roadmap.md)                     | Milestone breakdown and timeline |
| [Work items](docs/planning/work-items.yaml)             | Machine-readable task tracking   |
| [Status](docs/planning/status.md)                       | Current milestone progress       |
| [Risk register](docs/planning/risk-register.md)         | Known risks and mitigations      |
| [Decision log](docs/decisions/README.md)                | Architecture Decision Records    |
| [Working agreement](docs/planning/working-agreement.md) | Coding and review rules          |
| [Contributing](CONTRIBUTING.md)                         | How to contribute                |
| [Security](SECURITY.md)                                 | Vulnerability disclosure process |
| [Release process](RELEASE.md)                           | Versioning and release steps     |

## License

Apache-2.0 — see [LICENSE](LICENSE).
