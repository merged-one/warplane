# Warplane Roadmap

## Positioning

**Interchain Control Plane for Avalanche L1s** -- a production operations layer for
Teleporter/ICM-based applications. Positioned as an interoperability tool with secondary
indexer/explorer classification under Avalanche's infraBUIDL() grant program.

See [competitive-landscape.md](competitive-landscape.md) for ecosystem analysis and
[ADR-0007](../decisions/0007-four-milestone-grant-delivery.md) for milestone rationale.

---

## Milestone 1 -- Core Control Plane and Deterministic Test Harness

**Status:** Complete
**Completion date:** 2026-04-01
**Amount:** $30,000

### Deliverables

| #   | Deliverable                                 | Package(s)          | Status |
| --- | ------------------------------------------- | ------------------- | ------ |
| 1   | Canonical 11-event trace model (Zod v4)     | `packages/domain`   | Done   |
| 2   | SQLite storage with migrations and repos    | `packages/storage`  | Done   |
| 3   | Artifact ingestion pipeline with validation | `packages/ingest`   | Done   |
| 4   | Fastify REST API with OpenAPI 3.1           | `apps/api`          | Done   |
| 5   | React + Vite web dashboard                  | `apps/web`          | Done   |
| 6   | VitePress documentation site                | `apps/docs`         | Done   |
| 7   | Go tmpnet harness with 5 scenarios          | `harness/tmpnet`    | Done   |
| 8   | CLI with full command suite                 | `packages/cli`      | Done   |
| 9   | GitHub Actions CI pipeline                  | `.github/workflows` | Done   |
| 10  | ADR system, planning, governance            | `docs/`             | Done   |

### KPI Results

- Local e2e tests pass reliably in CI: **Yes** (197 tests, 2 CI jobs)
- Lifecycle trace for 100% of test messages: **Yes** (8 traces, 5 scenarios)
- Boot-to-traced-message under 30 minutes: **Yes** (`pnpm demo:seed` in ~60 seconds)

See [milestone-1-report.md](milestone-1-report.md) for full details.

---

## Milestone 2 -- Fuji Alpha for Observability, Relayer Ops, and Eventing

**Status:** Planned
**Target completion:** August 31, 2026
**Amount:** $40,000

### Goal

Extend the local foundation into a self-hosted alpha on Fuji, with real-time observability
for interchain applications and operational visibility into relayer health and delivery state.

### Deliverables

| #   | Deliverable                                          | Package(s)         | Priority |
| --- | ---------------------------------------------------- | ------------------ | -------- |
| 1   | RPC polling ingestion for TeleporterMessenger events | `packages/ingest`  | P0       |
| 2   | WebSocket subscription for real-time block headers   | `packages/ingest`  | P0       |
| 3   | Relayer Prometheus metrics integration               | `packages/ingest`  | P1       |
| 4   | Signature aggregator metrics integration             | `packages/ingest`  | P1       |
| 5   | Event normalization pipeline (8+ event types)        | `packages/ingest`  | P0       |
| 6   | Per-message tracing UI with lifecycle timeline       | `apps/web`         | P0       |
| 7   | Relayer operations panel (health, lag, failures)     | `apps/web`         | P1       |
| 8   | Webhook alerting for failed/delayed flows            | `apps/api`         | P1       |
| 9   | Docker Compose for self-hosted deployment            | root               | P1       |
| 10  | Fuji-compatible deployment guide                     | `apps/docs`        | P1       |
| 11  | E2E test wiring with real tmpnet                     | `harness/tmpnet`   | P1       |
| 12  | Postgres storage adapter                             | `packages/storage` | P2       |

### KPIs

- Ingest and normalize 1,000+ interchain events on Fuji
- p95 message-state freshness under 60 seconds
- At least 8 normalized event types
- At least 1 external design partner testing on Fuji

### Key Decisions

- [ADR-0005](../decisions/0005-rpc-first-multi-source-ingestion.md): RPC polling primary,
  Prometheus metrics supplementary
- [ADR-0006](../decisions/0006-event-model-contract-alignment.md): 11-event model aligned
  to 8 contract events + 3 off-chain derived states

### Why This Scope

Observability is the most acute gap in the Avalanche ICM ecosystem. No dedicated Teleporter
message explorer or trace viewer exists. The Webhooks API only supports `address_activity`,
and the Data API does not expose event log queries. Shipping real-time message tracing on
Fuji proves the architecture before building policy and remediation layers.

The relayer Prometheus metrics integration is a unique moat: 15 relayer metrics and 11
signature aggregator metrics provide operational signals invisible on-chain (relay latency,
failure classification, signature aggregation time, connected stake weight). No other tool
surfaces this data.

---

## Milestone 3 -- Policy Engine and Remediation Workflows

**Status:** Planned
**Target completion:** November 15, 2026
**Amount:** $35,000

### Goal

Add operational controls that transform the product from an explorer into a true
production control plane.

### Deliverables

| #   | Deliverable                                      | Package(s)                     | Priority |
| --- | ------------------------------------------------ | ------------------------------ | -------- |
| 1   | Policy engine: allowed relayers                  | `packages/domain`, `apps/api`  | P0       |
| 2   | Policy engine: fee floor / underfunded detection | `packages/domain`, `apps/api`  | P0       |
| 3   | Policy engine: retry windows                     | `packages/domain`, `apps/api`  | P1       |
| 4   | Policy engine: route allowlists                  | `packages/domain`, `apps/api`  | P1       |
| 5   | Policy engine: circuit-breaker conditions        | `packages/domain`, `apps/api`  | P1       |
| 6   | Remediation: replay-safe retry initiation        | `packages/cli`, `apps/api`     | P0       |
| 7   | Remediation: fee top-up workflow                 | `packages/cli`, `apps/api`     | P1       |
| 8   | Remediation: channel pause/unpause               | `packages/cli`, `apps/api`     | P1       |
| 9   | Remediation: relayer rotation/failover           | `packages/cli`, `apps/api`     | P2       |
| 10  | Environment promotion (local -> Fuji -> mainnet) | `packages/cli`                 | P1       |
| 11  | Audit log for operator actions                   | `packages/storage`, `apps/api` | P1       |
| 12  | Team roles and permissions                       | `apps/api`                     | P2       |

### KPIs

- At least 6 enforceable policies shipped
- At least 4 one-click remediation flows
- Mean time to diagnose a simulated failed message under 5 minutes
- At least 2 ecosystem teams running policy-enabled test flows

### Why This Scope

This milestone creates the differentiation from every existing cross-chain explorer.
Research shows that no tool anywhere in the industry provides declarative policy
enforcement or automated remediation workflows for cross-chain messaging. Teleporter
already exposes the contract-level primitives (retries via `retryMessageExecution`,
allowed relayers, fee management via `AddFeeAmount`), but no operational layer wraps
them into usable workflows.

The relayer stability issues documented in ICM Services issues (#1066, #473, #720, #602)
create concrete demand for circuit breakers and failover. The environment promotion
feature addresses the "Terraform for cross-chain operations" gap identified in the
competitive analysis.

---

## Milestone 4 -- Public Beta, Reference Integration, and Ecosystem Launch

**Status:** Planned
**Target completion:** January 31, 2027
**Amount:** $45,000

### Goal

Ship a production-grade beta, publish a concrete reference use case proving ecosystem
utility, and validate with real users.

### Deliverables

| #   | Deliverable                                         | Package(s)  | Priority |
| --- | --------------------------------------------------- | ----------- | -------- |
| 1   | Public beta release                                 | all         | P0       |
| 2   | Security hardening and review                       | all         | P0       |
| 3   | Public docs, API reference, quickstarts             | `apps/docs` | P0       |
| 4   | Reference integration: VRF cross-L1 service adapter | new package | P0       |
| 5   | At least 3 starter templates / example apps         | `examples/` | P1       |
| 6   | Partner case study or pilot writeup                 | `apps/docs` | P1       |
| 7   | Dashboard search integration                        | `apps/web`  | P2       |
| 8   | SPA routing fallback for production builds          | `apps/web`  | P2       |

### KPIs

- At least 1 public pilot or 2 private pilots
- At least 99.5% service uptime over a 30-day beta window
- At least 3 complete example apps / starter kits
- At least 3 teams complete onboarding using public docs

### Why This Scope

The reference integration (VRF cross-L1 service adapter) is strategically chosen because
Avalanche already documents the need to access Chainlink VRF from unsupported L1s via
Teleporter/ICM. This makes "service access across Avalanche L1s" a concrete,
ecosystem-native use case rather than a hypothetical feature. It demonstrates the full
control plane value chain: configure routes, monitor message delivery, detect failures,
trigger remediation.

---

## Timeline Summary

```
2026-04-01  M1 Complete ────────────────────────────────────────────
2026-05     M2 Start: RPC ingestion, event normalization
2026-06     M2: Per-message tracing UI, relayer ops panel
2026-07     M2: Webhook alerting, Docker Compose
2026-08-31  M2 Complete: Fuji alpha deployed ───────────────────────
2026-09     M3 Start: Policy engine design
2026-10     M3: Remediation workflows, env promotion
2026-11-15  M3 Complete: Policy engine shipped ─────────────────────
2026-12     M4 Start: Security hardening, reference integration
2027-01-31  M4 Complete: Public beta launched ──────────────────────
```

## Links

- [Competitive landscape](competitive-landscape.md)
- [Work items (machine-readable)](work-items.yaml)
- [Milestone 1 report](milestone-1-report.md)
- [Decision log](../decisions/README.md)
- [Risk register](risk-register.md)
