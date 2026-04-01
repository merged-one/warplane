# Warplane -- Product One-Pager

## Problem

Avalanche L1 operators manage multiple subnets and chains across fragmented tooling.
There is no unified control plane to observe health, trigger lifecycle operations, or
orchestrate cross-chain workflows. Operators resort to ad-hoc scripts, manual RPC calls,
and separate dashboards per chain.

## Vision

A single pane of glass for Avalanche L1 management: observe chain health, manage subnet
lifecycles, and orchestrate cross-chain operations from one interface (web, CLI, or API).

## Target users

| Persona | Need |
|---------|------|
| **L1 Operator** | Real-time health monitoring, alerting, lifecycle automation |
| **Subnet Developer** | Fast local dev loops, fixture-based testing, deployment tooling |
| **Platform Team** | Multi-chain visibility, governance, compliance dashboards |

## Key capabilities (Milestone 1 -- Day-1 MVP)

1. **Domain model** -- Typed representation of chains, subnets, and health states
2. **Ingest pipeline** -- Poll Avalanche nodes for chain status (fixture data in M1)
3. **REST API** -- `/healthz`, `/api/v1/chains` for programmatic access
4. **Web dashboard** -- React shell showing chain status
5. **CLI** -- `warplane ping` for basic connectivity checks
6. **Docs site** -- VitePress-powered documentation
7. **Test harness** -- Go-based tmpnet integration for e2e testing

## Success metrics

| Metric | M1 Target |
|--------|-----------|
| Build + test pass rate | 100% on CI |
| Domain model coverage | Core types for Chain, Subnet, HealthStatus |
| API endpoints | `/healthz` + `/api/v1/chains` responding |
| e2e harness | Go tmpnet compiles and has smoke test |

## Risks

- Avalanche RPC API changes could break ingest pipeline
- tmpnet stability is experimental; e2e tests may be flaky
- Monorepo tooling (pnpm workspaces + Go modules) adds build complexity

## Non-goals (Milestone 1)

- Production deployment or hosting
- Real RPC polling (fixture data only)
- Authentication or authorization
- Multi-tenant support

## Architecture

See [ADR-0002](../decisions/0002-use-monorepo-with-ts-and-go.md) for monorepo rationale.

```
┌─────────┐  ┌─────────┐  ┌─────────┐
│  Web UI │  │   CLI   │  │ Docs MCP│
└────┬────┘  └────┬────┘  └────┬────┘
     │            │            │
     └──────┬─────┘            │
            ▼                  │
       ┌─────────┐             │
       │   API   │◄────────────┘
       └────┬────┘
            │
     ┌──────┴──────┐
     ▼             ▼
┌─────────┐  ┌─────────┐
│ Domain  │  │ Storage │
└────┬────┘  └─────────┘
     │
     ▼
┌─────────┐
│ Ingest  │──► Avalanche Nodes
└─────────┘
```

## Links

- [Roadmap](../planning/roadmap.md)
- [Work items](../planning/work-items.yaml)
- [Decision log](../decisions/README.md)
