# ADR-0006: Event Model Aligned to TeleporterMessenger Contract Events

## Status

Accepted

## Date

2026-04-02

## Context and Problem Statement

Warplane's domain model defines an 11-event lifecycle for Teleporter messages (see
`packages/domain/src/events.ts`). The TeleporterMessenger contract emits exactly 8
Solidity events. We need to validate that our model accurately represents the on-chain
reality, identify which of our events are on-chain vs. derived from off-chain sources,
and ensure the model is forward-compatible with TeleporterMessengerV2.

## Decision Drivers

- TeleporterMessenger (v1.0.9) emits exactly 8 events: `BlockchainIDInitialized`,
  `SendCrossChainMessage`, `ReceiveCrossChainMessage`, `AddFeeAmount`, `MessageExecuted`,
  `MessageExecutionFailed`, `ReceiptReceived`, `RelayerRewardsRedeemed`
- Our model has 11 event kinds that must map cleanly to these 8 contract events plus
  off-chain relayer/aggregator states
- TeleporterMessengerV2 (ava-labs/icm-services#1213) will support multiple verification
  mechanisms beyond AWM, requiring the event model to be verification-scheme-agnostic
- The model must support both golden fixture mode (M1) and live RPC ingestion (M2+)
- Event ordering and causality must be preserved across chains

## Considered Options

1. 11-event model: 8 contract-aligned events + 3 off-chain derived events
2. 8-event model: strict 1:1 with contract events only
3. Extensible envelope model: generic event with typed payload

## Decision Outcome

Chosen option: "11-event model with explicit on-chain/off-chain distinction", because
it captures the full operational lifecycle visible to a control plane operator, not just
the on-chain contract interactions. The three off-chain events represent critical
operational visibility that no on-chain event provides.

### Event-to-Contract Mapping

| Warplane event kind      | Source    | TeleporterMessenger event           | Chain       |
| ------------------------ | --------- | ----------------------------------- | ----------- |
| `message_sent`           | On-chain  | `SendCrossChainMessage`             | Source      |
| `warp_message_extracted` | Off-chain | (relayer observes Warp log)         | Source      |
| `signatures_aggregated`  | Off-chain | (sig-agg completes BLS aggregation) | Off-chain   |
| `relay_submitted`        | Off-chain | (relayer submits delivery tx)       | Destination |
| `delivery_confirmed`     | On-chain  | `ReceiveCrossChainMessage`          | Destination |
| `execution_failed`       | On-chain  | `MessageExecutionFailed`            | Destination |
| `retry_requested`        | On-chain  | (`retryMessageExecution` call)      | Destination |
| `retry_succeeded`        | On-chain  | `MessageExecuted` (after retry)     | Destination |
| `fee_added`              | On-chain  | `AddFeeAmount`                      | Source      |
| `receipts_sent`          | On-chain  | `ReceiptReceived`                   | Source      |
| `replay_blocked`         | On-chain  | (duplicate message ID rejected)     | Destination |

### Forward Compatibility

The three off-chain events (`warp_message_extracted`, `signatures_aggregated`,
`relay_submitted`) are labeled by their current AWM-based verification flow. When
TeleporterMessengerV2 adds alternative verification mechanisms (e.g., CCTP, external
oracles), these events will generalize to `verification_initiated`, `verification_completed`,
`delivery_submitted` -- the lifecycle phase remains the same, only the verification
scheme changes.

### Consequences

**Good:**

- Complete operational visibility: operators see where a message is in its lifecycle,
  including the off-chain relay and aggregation phases that are invisible on-chain
- Clean mapping to contract events makes RPC-based ingestion straightforward
- Off-chain events sourced from relayer/sig-agg Prometheus metrics and API responses
- Forward-compatible with TeleporterMessengerV2 multi-verification model
- Discriminated union in Zod validates event shape at runtime

**Bad:**

- Three off-chain events depend on relayer/sig-agg observability access, which may
  not be available for all deployments (e.g., third-party relayers without exposed metrics)
- Must handle partial traces where off-chain events are missing (degrade gracefully)

**Neutral:**

- The `BlockchainIDInitialized` and `RelayerRewardsRedeemed` contract events are
  administrative/settlement events, not part of the per-message lifecycle -- correctly
  excluded from the 11-event model
- Schema versioning (minor bump) will be used if event kinds are added in the future

## Pros and Cons of the Options

### 11-event model (chosen)

- Good, because captures full operational lifecycle including relay/aggregation phases
- Good, because off-chain events provide unique operational value (latency, failure classification)
- Good, because maps cleanly to existing domain model and golden fixtures
- Bad, because off-chain events require access to relayer/sig-agg infrastructure

### 8-event model (contract-only)

- Good, because simpler, no off-chain dependencies
- Bad, because misses the relay and aggregation phases entirely
- Bad, because operators cannot see where a message is stuck between send and delivery
- Bad, because loses the primary operational value proposition

### Extensible envelope model

- Good, because maximum flexibility for future event types
- Bad, because loses type safety and discriminated union validation
- Bad, because harder to reason about lifecycle completeness
- Bad, because over-engineered for the current scope

## More Information

- [TeleporterMessenger events (ITeleporterMessenger.sol)](https://github.com/ava-labs/icm-contracts/blob/main/contracts/teleporter/ITeleporterMessenger.sol)
- [TeleporterMessengerV2 plans (issue #1213)](https://github.com/ava-labs/icm-services/issues/1213)
- [Domain events source](../../packages/domain/src/events.ts)
- [Trace model runbook](../runbooks/trace-model.md)
- [ADR-0005: RPC-first multi-source ingestion](0005-rpc-first-multi-source-ingestion.md)
