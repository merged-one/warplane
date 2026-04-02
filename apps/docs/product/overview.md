# Product Overview

Warplane is an interchain control plane for Avalanche L1s. It provides unified observability, lifecycle management, and cross-chain orchestration for subnet operators.

## Problem

Avalanche L1 operators manage multiple subnets and chains across fragmented tooling. There is no unified control plane to observe health, trigger lifecycle operations, or orchestrate cross-chain workflows.

## Target Users

| Persona              | Need                                                            |
| -------------------- | --------------------------------------------------------------- |
| **L1 Operator**      | Real-time health monitoring, alerting, lifecycle automation     |
| **Subnet Developer** | Fast local dev loops, fixture-based testing, deployment tooling |
| **Platform Team**    | Multi-chain visibility, governance, compliance dashboards       |

## Key Capabilities

1. **Domain model** — Typed representation of chains, subnets, and health states
2. **Ingest pipeline** — Poll Avalanche nodes for chain status
3. **REST API** — Programmatic access to chain data
4. **Web dashboard** — Visual chain status overview
5. **CLI** — Command-line management and monitoring
6. **Docs MCP server** — LLM-friendly documentation access

## Architecture

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

- [Roadmap](/planning/roadmap)
- [Architecture](/architecture/overview)
- [ADRs](/decisions/)
