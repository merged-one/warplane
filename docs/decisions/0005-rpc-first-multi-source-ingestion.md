# ADR-0005: RPC-First Multi-Source Data Ingestion

## Status

Accepted

## Date

2026-04-02

## Context and Problem Statement

Warplane needs to ingest real Teleporter/ICM message lifecycle data from Avalanche L1s
to replace the golden fixture approach used in Milestone 1 (see ADR-0003). There are
multiple potential data sources -- each with different coverage, latency, and reliability
characteristics. We need to choose a primary ingestion strategy and determine which
supplementary sources to integrate.

## Decision Drivers

- Must capture all 8 TeleporterMessenger contract events across source and destination L1s
- Must correlate events across chains into unified message traces
- AvaCloud Webhooks API only supports `address_activity` -- no Teleporter-native events
- AvaCloud Data API (Glacier) does not expose raw event log queries (`eth_getLogs` equivalent)
- ICM Relayer exposes 15 Prometheus metrics on port 9090 (including `successful_relay_message_count`,
  `failed_relay_message_count` with `failure_reason`, `create_signed_message_latency_ms`)
- Signature Aggregator exposes 11 Prometheus metrics on port 8081 (including `agg_sigs_latency_ms`,
  `validator_timeouts`, `connected_stake_weight_percentage`)
- Need sub-60-second message-state freshness for the Fuji alpha (M2 KPI)
- Must work for self-hosted deployments where operators run their own relayers

## Considered Options

1. RPC polling (`eth_getLogs`) as primary, with relayer/sig-agg Prometheus metrics as supplementary
2. AvaCloud Webhooks API as primary
3. Custom indexer using SubQuery or Envio multi-chain mode
4. Direct relayer integration (listen to relayer's internal event stream)

## Decision Outcome

Chosen option: "RPC polling as primary with Prometheus metrics supplementary", because
it is the only approach that provides complete, reliable access to all TeleporterMessenger
contract events across arbitrary L1s, works for self-hosted deployments, and does not
depend on third-party indexing services.

### Consequences

**Good:**

- Complete coverage of all 8 TeleporterMessenger events on any L1 with an RPC endpoint
- No dependency on AvaCloud services -- works for self-hosted and air-gapped deployments
- Relayer Prometheus metrics provide operational signals not visible on-chain (relay latency,
  failure reasons, signature aggregation time, connected stake weight)
- Architecture matches how the ICM Relayer itself ingests data (it polls via RPC + WebSocket)
- Sub-60-second freshness achievable with WebSocket subscriptions for new block headers

**Bad:**

- Requires maintaining RPC connections to every monitored L1 (N connections for N L1s)
- Higher infrastructure cost than a push-based webhook approach
- Must handle RPC node availability, rate limiting, and reorg edge cases
- Prometheus scraping requires network access to relayer/sig-agg instances

**Neutral:**

- AvaCloud Webhooks can be added as an optional supplementary source later if Teleporter-native
  events are added to the API
- The ingest pipeline already has a watcher/poll architecture from M1 that can be adapted

## Pros and Cons of the Options

### RPC polling + Prometheus metrics

- Good, because complete event coverage on any L1
- Good, because works self-hosted without third-party dependencies
- Good, because relayer metrics provide unique operational signals (failure_reason, latency)
- Good, because matches the relayer's own ingestion pattern
- Bad, because requires N RPC connections for N monitored L1s
- Bad, because must handle reorgs and RPC availability

### AvaCloud Webhooks API

- Good, because push-based (lower latency potential)
- Good, because managed infrastructure
- Bad, because only supports `address_activity` -- no Teleporter-native events
- Bad, because requires manual log decoding and cross-chain correlation
- Bad, because creates dependency on AvaCloud availability
- Bad, because does not work for self-hosted deployments without AvaCloud

### Custom indexer (SubQuery/Envio)

- Good, because multi-chain indexing into a single database
- Good, because declarative event handlers
- Bad, because no native cross-chain message lifecycle semantics
- Bad, because adds a third-party dependency and deployment complexity
- Bad, because indexer lag adds latency on top of RPC lag

### Direct relayer integration

- Good, because lowest-latency access to relay decisions
- Bad, because tightly couples to relayer internals
- Bad, because relayer architecture is changing (issue #1213: shift to Teleporter events)
- Bad, because only captures relay phase, not source-chain or destination-chain events

## More Information

- [ICM Relayer metrics source](https://github.com/ava-labs/icm-services/blob/main/relayer/application_relayer_metrics.go)
- [Signature Aggregator metrics source](https://github.com/ava-labs/icm-services/blob/main/signature-aggregator/metrics/metrics.go)
- [AvaCloud Webhooks API](https://developers.avacloud.io/webhooks-api/overview)
- [AvaCloud Data API](https://developers.avacloud.io/data-api/overview)
- [Competitive landscape analysis](../planning/competitive-landscape.md)
