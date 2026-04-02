# ADR-0007: Four-Milestone Grant Delivery Structure

## Status

Accepted

## Date

2026-04-02

## Context and Problem Statement

Warplane is seeking $150,000 from Avalanche's infraBUIDL() program across four milestones.
We need to decide how to scope and sequence the milestones to maximize grant fundability,
deliver incremental value at each stage, and build defensible competitive position in
the Avalanche ICM observability space. The milestone structure must align with infraBUIDL()
expectations (project abstract, technical roadmap, deliverables, KPIs, completion dates,
and amounts per milestone).

## Decision Drivers

- infraBUIDL() explicitly funds interoperability tools, explorers, and indexers
- No competing project exists for Avalanche ICM/Teleporter observability (see competitive
  landscape analysis)
- Milestone 1 is already complete (core control plane, test harness, 5 scenarios, CI)
- 81 mainnet L1s and growing; institutional adoption accelerating
- TeleporterMessengerV2 planned (multi-verification support) -- architecture must be
  forward-compatible
- Relayer operational stability issues documented in 6+ GitHub issues create immediate demand
- Each milestone must be independently valuable (not just scaffolding for the next)

## Considered Options

1. Four milestones: Foundation (done) -> Fuji Alpha -> Policy Engine -> Public Beta
2. Three milestones: Foundation (done) -> Full Platform -> Public Launch
3. Five milestones: Foundation (done) -> Ingestion -> Observability -> Policy -> Beta
4. Two milestones: Foundation (done) -> Complete Platform

## Decision Outcome

Chosen option: "Four milestones", because it provides the best balance of incremental
value delivery, grant milestone cadence, and risk distribution. Each milestone delivers
a usable product increment, not just infrastructure preparation.

### Milestone Structure

| #   | Name                                                 | Deliverable                                                           | Ask     | Target       |
| --- | ---------------------------------------------------- | --------------------------------------------------------------------- | ------- | ------------ |
| M1  | Core control plane and test harness                  | Open-source monorepo, API, CLI, 5 scenarios, CI                       | $30,000 | Complete     |
| M2  | Fuji alpha for observability and eventing            | Real data ingestion, per-message tracing, relayer ops, alerting       | $40,000 | Aug 31, 2026 |
| M3  | Policy engine and remediation workflows              | Declarative policies, retry/fee-top-up/circuit-breaker, env promotion | $35,000 | Nov 15, 2026 |
| M4  | Public beta, reference integration, ecosystem launch | Security hardening, docs, VRF cross-L1 reference app, partner pilots  | $45,000 | Jan 31, 2027 |

### Why This Phasing

**M1 -> M2 (observability first):** The research shows that observability is the most
acute gap. No ICM tooling exists. Shipping a Fuji-connected alpha with real message
tracing provides immediate value and validates the architecture before building policy
and remediation layers on top.

**M2 -> M3 (policy and remediation):** Once observability proves the data model works
with real Teleporter events, the policy engine can enforce operational constraints
(allowed relayers, fee floors, retry windows) that teams need for production. This is
the feature layer that transforms an explorer into a control plane.

**M3 -> M4 (beta and ecosystem proof):** The final milestone validates the full stack
with real users, a concrete reference integration (VRF cross-L1 workflow), and
production-grade hardening. This is where ecosystem impact becomes measurable.

### Consequences

**Good:**

- Each milestone delivers a usable product (not just infrastructure)
- M1 already complete -- demonstrates execution ability to grant reviewers
- Observability-first phasing addresses the most acute ecosystem gap immediately
- Policy engine in M3 creates the differentiation from "another explorer"
- Reference integration in M4 provides a concrete demonstration of ecosystem value
- Timeline (10 months from M2 start to M4 completion) is aggressive but achievable

**Bad:**

- $150K total is modest for the scope -- constrains hiring and infrastructure spend
- 4-month M2 timeline is tight for Fuji deployment + real data ingestion
- M4's security hardening could surface issues that require additional time

**Neutral:**

- Grant structure assumes single-developer execution with potential contractor support
- Retro9000 retroactive grants could supplement infraBUIDL() funding based on ecosystem impact
- Timeline can be renegotiated with the Foundation if specific milestones need adjustment

## Pros and Cons of the Options

### Four milestones (chosen)

- Good, because each milestone delivers independently useful output
- Good, because matches infraBUIDL() expectation of 4 milestones with KPIs
- Good, because distributes risk across ~3-month increments
- Good, because observability-first phasing addresses the most acute gap
- Bad, because $150K is tight for 10 months of development

### Three milestones

- Good, because fewer milestones mean less overhead
- Bad, because "Full Platform" milestone is too large and risky
- Bad, because does not match infraBUIDL() application structure

### Five milestones

- Good, because more granular risk distribution
- Bad, because splits observability and ingestion unnecessarily
- Bad, because more milestone overhead and reporting

### Two milestones

- Good, because simplest structure
- Bad, because second milestone is too large
- Bad, because no incremental value delivery

## More Information

- [infraBUIDL() program](https://build.avax.network/grants/infrabuidl)
- [Competitive landscape analysis](../planning/competitive-landscape.md)
- [ADR-0005: RPC-first multi-source ingestion](0005-rpc-first-multi-source-ingestion.md)
- [ADR-0006: Event model contract alignment](0006-event-model-contract-alignment.md)
- [Milestone 1 report](../planning/milestone-1-report.md)
