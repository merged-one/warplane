# ADR-0008: Prometheus-Based Off-Chain Event Correlation

## Status

Accepted

## Date

2026-04-02

## Context and Problem Statement

Warplane's 11-event lifecycle model (ADR-0006) includes three off-chain events that are
invisible on-chain: `warp_message_extracted`, `signatures_aggregated`, and `relay_submitted`.
These events represent the relay and signature aggregation phases between `message_sent`
(source chain) and `delivery_confirmed` (destination chain). We need to decide how to
source these events, parse the data, correlate them with on-chain traces (since Prometheus
counters lack per-message granularity), and handle unavailability gracefully.

## Decision Drivers

- ICM Relayer exposes 15 Prometheus metrics on port 9090 including
  `successful_relay_message_count` (counter with chain-pair labels) and
  `create_signed_message_latency_ms` (gauge)
- Signature Aggregator exposes 11 Prometheus metrics on port 8081 including
  `agg_sigs_req_count` (counter) and `connected_stake_weight_percentage` (gauge)
- Prometheus counters are aggregate — they carry chain-pair labels but no per-message ID
- The existing pipeline (normalizer, correlator, coordinator) already supports off-chain
  event kinds in the FSM state transitions
- The codebase has zero external HTTP dependencies (only `viem` for RPC)
- Must work for self-hosted deployments where metrics endpoints may be unavailable

## Considered Options

1. Custom Prometheus text parser + chain-pair temporal FIFO correlation
2. Use `prom-client` library's `parseMetrics` utility + exact message ID matching via relayer API
3. Direct relayer event stream integration (gRPC/WebSocket)

## Decision Outcome

Chosen option: "Custom Prometheus text parser + chain-pair temporal FIFO correlation",
because the Prometheus text exposition format is simple enough to parse without a dependency,
the relayer API does not expose per-message relay events, and temporal FIFO correlation
provides sufficient accuracy for operational visibility.

### Custom Prometheus Text Parser

The Prometheus text exposition format (`text/plain; version=0.0.4`) is a line-oriented
format with comments (`# HELP`, `# TYPE`), metric lines (`name{labels} value [timestamp]`),
and histogram/summary suffixes (`_bucket`, `_sum`, `_count`). A custom parser avoids adding
`prom-client` (190KB+ with dependencies) when we only need the parsing half (not exposition).

### Off-Chain MessageId Correlation Strategy

Since Prometheus counters track aggregate counts per chain pair (not per message), we use
a best-effort temporal FIFO strategy:

1. **Counter delta detection:** Compare current counter value with previous scrape to detect
   new relay successes/aggregation completions since last scrape interval
2. **Chain-pair matching:** Counter labels `source_chain_id` and `destination_chain_id` narrow
   the set of candidate traces to those pending on that specific chain pair
3. **Temporal FIFO assignment:** Among pending traces for a chain pair, assign off-chain events
   to the oldest pending trace first (relay order mirrors send order in normal operation)
4. **Synthetic messageId fallback:** If no pending trace matches the chain pair, generate a
   synthetic `metrics:<src>:<dst>:<timestamp>` messageId — the correlator creates a partial
   trace that gets completed when the on-chain `delivery_confirmed` arrives with the real
   messageId
5. **Batch distribution:** A single scrape interval may report delta > 1 (multiple relays).
   Each unit of delta is assigned to the next oldest pending trace for that chain pair.

This strategy is inherently approximate — a scrape interval of 10 seconds means events are
attributed to traces within that time window. This is acceptable for operational visibility
(the primary use case) where knowing "a relay happened for this chain pair in this window"
is more valuable than no off-chain visibility at all.

### HTTP Client

Node.js built-in `fetch` (stable since Node 18) with `AbortController` for request timeout.
No `axios`, `undici`, or `node-fetch` added — consistent with the project's minimal
dependency approach.

### Graceful Degradation

When metrics endpoints are unavailable (connection refused, timeout, non-200 response):

- Log a warning (not an error — this is expected in some deployments)
- Retain last-known metric values for health snapshot continuity
- Mark the scraper as unhealthy (`isHealthy() → false`)
- Traces continue progressing through on-chain events only — the FSM supports direct
  `pending → delivered` transition without requiring off-chain events in between

### Consequences

**Good:**

- No new dependencies — custom parser is ~80 lines, well-tested
- Off-chain events enrich traces with relay/aggregation visibility when available
- Health snapshots provide operational value even without per-message correlation
- Graceful degradation means traces work correctly in all deployment scenarios
- Chain-pair FIFO correlation handles the common case (single relayer, ordered delivery) well

**Bad:**

- Temporal FIFO correlation is approximate — reordered relays or concurrent relayers for the
  same chain pair may attribute events to the wrong trace
- 10-second scrape interval means off-chain events have 0–10s attribution uncertainty
- Synthetic messageId traces create temporary partials that require on-chain completion

**Neutral:**

- When the ICM Relayer adds per-message event streaming (planned in icm-services roadmap),
  this correlation strategy can be replaced with exact matching — the pipeline architecture
  (`injectEvents()` method) will work identically with either correlation approach

## Pros and Cons of the Options

### Custom parser + temporal FIFO (chosen)

- Good, because zero new dependencies
- Good, because works with existing Prometheus metric format
- Good, because graceful degradation when endpoints unavailable
- Bad, because correlation is approximate (no per-message ID from counters)
- Bad, because requires custom parser maintenance

### prom-client + relayer API

- Good, because well-tested Prometheus parsing
- Bad, because adds 190KB+ dependency for parsing only
- Bad, because relayer API does not currently expose per-message relay events
- Bad, because would create a hard dependency on relayer API availability

### Direct relayer event stream

- Good, because exact per-message correlation
- Bad, because relayer does not expose an event stream API
- Bad, because tightly couples to relayer internals
- Bad, because relayer architecture is changing (icm-services #1213)

## More Information

- [ICM Relayer metrics source](https://github.com/ava-labs/icm-services/blob/main/relayer/application_relayer_metrics.go)
- [Signature Aggregator metrics source](https://github.com/ava-labs/icm-services/blob/main/signature-aggregator/metrics/metrics.go)
- [Prometheus text exposition format](https://prometheus.io/docs/instrumenting/exposition_formats/#text-based-format)
- [ADR-0005: RPC-first multi-source ingestion](0005-rpc-first-multi-source-ingestion.md)
- [ADR-0006: Event model contract alignment](0006-event-model-contract-alignment.md)
- [Milestone 2 plan, Stage 3](../planning/milestone-2-plan.md)
