# Product Overview

Warplane is an interchain control plane for Avalanche L1s. It provides cross-chain message tracing, deterministic test scenarios, and unified observability for Teleporter-based communication across subnet operators.

## Problem

Avalanche L1 operators using Teleporter for cross-chain messaging lack visibility into message lifecycles. When a message fails to deliver, triggers a retry, or encounters replay protection, there is no unified tool to trace what happened across chains.

## Target Users

| Persona                | Need                                                               |
| ---------------------- | ------------------------------------------------------------------ |
| **Subnet operators**   | Trace message failures across chains without manual log parsing    |
| **Relayer operators**  | Verify relay delivery and fee handling                             |
| **dApp developers**    | Test cross-chain message flows against deterministic scenarios     |
| **Protocol engineers** | Validate Teleporter behavior changes against a known-good baseline |
| **Tooling builders**   | Build on typed schemas and OpenAPI specs                           |

## Key Capabilities

1. **Trace model** — Canonical 11-event lifecycle model for Teleporter messages
2. **Test scenarios** — 5 deterministic scenarios covering success, failure, retry, fees, and replay
3. **REST API** — Full query layer with OpenAPI 3.1 documentation
4. **Web dashboard** — Trace explorer with timeline visualization and failure views
5. **CLI** — Terminal-based querying with JSON output for scripting
6. **Schema system** — Zod-based types generating TypeScript, JSON Schema, and OpenAPI specs
7. **Docs MCP server** — LLM-friendly documentation access

## Architecture

```
Golden Fixtures ──► Ingest ──► SQLite Storage
(or live tmpnet)              ┌──────┴──────┐
                              ▼             ▼
                         ┌─────────┐  ┌──────────┐
                         │   API   │  │ Dashboard │
                         └────┬────┘  └──────────┘
                              │
                         ┌────┴────┐
                         │   CLI   │
                         └─────────┘
```

## Links

- [Community Value](/product/community-value)
- [Seeded Demo](/product/seeded-demo)
- [Architecture](/architecture/overview)
- [Roadmap](/planning/roadmap)
- [ADRs](/decisions/)
