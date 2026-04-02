# Trace Model Reference

> Canonical event model for Teleporter cross-chain message tracing.
> Source of truth: `packages/domain/src/trace.ts` and `packages/domain/src/events.ts`.

## Schema Version

The trace schema is versioned via `schemaVersion` (default `"1.0.0"`).
Schema versions follow semver:

- **Patch**: additive optional fields, documentation changes
- **Minor**: new event kinds added to the discriminated union
- **Major**: breaking changes to required field shapes or removals

Consumers should check `schemaVersion` and handle unknown event kinds gracefully.

## MessageTrace

A `MessageTrace` captures the full lifecycle of a single Teleporter cross-chain message. It is the primary unit of observability in the Interchain Control Plane.

### Core Fields

| Field               | Type                | Required                | Description                                           |
| ------------------- | ------------------- | ----------------------- | ----------------------------------------------------- |
| `schemaVersion`     | string              | yes (default `"1.0.0"`) | Schema version for forwards-compatible evolution      |
| `messageId`         | string              | yes                     | SHA-256 deterministic message identifier              |
| `scenario`          | string              | yes                     | Scenario that produced this trace                     |
| `execution`         | ExecutionStatus     | yes                     | Lifecycle outcome                                     |
| `source`            | ChainMeta           | yes                     | Source chain metadata                                 |
| `destination`       | ChainMeta           | yes                     | Destination chain metadata                            |
| `sender`            | string              | yes                     | Sender EVM address                                    |
| `recipient`         | string              | yes                     | Recipient EVM address                                 |
| `sourceTxHash`      | string              | yes                     | Transaction hash on source chain                      |
| `destinationTxHash` | string              | no                      | Transaction hash on destination chain                 |
| `relayTxHash`       | string              | no                      | Relay transaction hash (if distinct from destination) |
| `timestamps`        | TraceTimestamps     | yes                     | Send/receive times and block numbers                  |
| `events`            | MessageEvent[]      | yes                     | Ordered lifecycle events                              |
| `relayer`           | RelayerInfo         | no                      | Relayer address and transaction                       |
| `fee`               | FeeInfo             | no                      | Fee token and amounts                                 |
| `retry`             | RetryInfo           | no                      | Retry gas limits and tx hash                          |
| `rawRefs`           | string[]            | no                      | All referenced transaction hashes                     |
| `artifacts`         | ArtifactReference[] | no                      | Pointers to related files                             |

### Supplementary Fields

These fields support day-1 MVP queries without requiring event parsing:

| Field                      | Type    | Description                                    |
| -------------------------- | ------- | ---------------------------------------------- |
| `requiredGasLimit`         | number  | Gas limit set for message execution            |
| `feeTokenAddress`          | string  | Address of the fee token contract              |
| `feeAmount`                | string  | Total fee amount (as string for BigInt safety) |
| `relayerAddress`           | string  | Address of the relayer                         |
| `receiptDelivered`         | boolean | Whether a receipt was delivered                |
| `retryCount`               | number  | Number of retry attempts                       |
| `replayProtectionObserved` | boolean | Whether replay protection fired                |

## ChainMeta

Identifies a chain in the context of a trace.

| Field          | Type   | Description               |
| -------------- | ------ | ------------------------- |
| `name`         | string | Human-readable chain name |
| `blockchainId` | string | Avalanche blockchain ID   |
| `subnetId`     | string | Avalanche subnet ID       |
| `evmChainId`   | number | EVM chain ID              |

## ExecutionStatus

Discriminant for the final outcome of a message:

| Value            | Meaning                                        |
| ---------------- | ---------------------------------------------- |
| `success`        | Message delivered and executed successfully    |
| `retry_success`  | Execution failed initially, succeeded on retry |
| `replay_blocked` | Duplicate message blocked by replay protection |
| `failed`         | Execution failed with no successful retry      |
| `pending`        | Message in flight, not yet resolved            |

## MessageEvent (Discriminated Union)

Events are ordered chronologically and discriminated by `kind`. All events have:

- `kind` (string) -- the discriminant
- `timestamp` (ISO 8601 datetime)
- `details` (optional string)

On-chain events additionally have `blockNumber`, `txHash`, and `chain`.

### Event Kinds

| Kind                     | On-chain | Chain       | Description                           |
| ------------------------ | -------- | ----------- | ------------------------------------- |
| `message_sent`           | yes      | source      | `sendCrossChainMessage` emitted       |
| `warp_message_extracted` | no       | source      | Warp message parsed from receipt logs |
| `signatures_aggregated`  | no       | --          | Quorum BLS signatures collected       |
| `relay_submitted`        | yes      | destination | `receiveCrossChainMessage` submitted  |
| `delivery_confirmed`     | yes      | destination | `MessageReceived == true`             |
| `execution_failed`       | yes      | destination | Execution reverted                    |
| `retry_requested`        | yes      | destination | `retryMessageExecution` called        |
| `retry_succeeded`        | yes      | destination | Retry execution succeeded             |
| `fee_added`              | yes      | source      | `AddFeeAmount` called                 |
| `receipts_sent`          | yes      | source      | `sendSpecifiedReceipts` called        |
| `replay_blocked`         | yes      | destination | Duplicate message rejected            |

### Happy Path Event Sequence

```
message_sent -> warp_message_extracted -> signatures_aggregated -> relay_submitted -> delivery_confirmed
```

### Retry Path

```
... -> relay_submitted -> execution_failed -> retry_requested -> retry_succeeded
```

### Replay Rejection Path

```
message_sent -> warp_message_extracted -> signatures_aggregated -> replay_blocked
```

## Ingestion Design

The schema is intentionally source-agnostic. The current golden fixtures are generated by the Go tmpnet harness. Future ingestion sources include:

- Live Avalanche RPC event subscriptions
- Relayer API polling
- Block explorer indexed data

Each source normalizes to the same `MessageTrace` / `MessageEvent` shapes.

## Generated Artifacts

Running `pnpm --filter @warplane/domain run generate` produces:

- `packages/domain/generated/*.schema.json` -- JSON Schema for each domain type
- `packages/domain/generated/openapi-components.json` -- OpenAPI 3.1 component bundle

These are checked in and should be regenerated whenever schemas change.

## Validation

All golden trace fixtures under `harness/tmpnet/artifacts/` are validated against these schemas in the domain test suite. Run:

```bash
pnpm test
```
