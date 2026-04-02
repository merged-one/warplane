# Trace Glossary

Definitions for terms used in the Warplane trace model and Teleporter message lifecycle.

## Core Concepts

### Message Trace

A `MessageTrace` is the primary observability unit. It captures the full lifecycle of a single Teleporter cross-chain message, from the initial `sendCrossChainMessage` call through delivery, retry, or rejection.

### Message Event

A `MessageEvent` is a single step in the trace timeline. Events are discriminated by `kind` and ordered chronologically. Each event has a timestamp and optional details.

### Execution Status

The final outcome of a message trace:

| Status           | Meaning                                        |
| ---------------- | ---------------------------------------------- |
| `success`        | Message delivered and executed successfully    |
| `retry_success`  | Execution failed initially, succeeded on retry |
| `replay_blocked` | Duplicate message blocked by replay protection |
| `failed`         | Execution failed with no successful retry      |
| `pending`        | Message in flight, not yet resolved            |

### Scenario

A named test case that exercises a specific Teleporter code path. Each scenario produces one or more message traces and records its execution metadata in a `ScenarioRun`.

## Event Kinds

### Source Chain Events

| Kind                     | Description                                       |
| ------------------------ | ------------------------------------------------- |
| `message_sent`           | `sendCrossChainMessage` emitted on source chain   |
| `warp_message_extracted` | Warp message parsed from transaction receipt logs |
| `fee_added`              | `AddFeeAmount` called to increase relay incentive |
| `receipts_sent`          | `sendSpecifiedReceipts` called for batch delivery |

### Off-Chain Events

| Kind                    | Description                                     |
| ----------------------- | ----------------------------------------------- |
| `signatures_aggregated` | Quorum BLS signatures collected from validators |

### Destination Chain Events

| Kind                 | Description                                             |
| -------------------- | ------------------------------------------------------- |
| `relay_submitted`    | `receiveCrossChainMessage` submitted on destination     |
| `delivery_confirmed` | Message execution succeeded (`MessageReceived == true`) |
| `execution_failed`   | Message delivered but execution reverted                |
| `retry_requested`    | `retryMessageExecution` called                          |
| `retry_succeeded`    | Retry execution succeeded                               |
| `replay_blocked`     | Duplicate or wrong-chain delivery rejected              |

## Event Sequences

### Happy Path

```
message_sent → warp_message_extracted → signatures_aggregated → relay_submitted → delivery_confirmed
```

### Retry Path

```
message_sent → ... → relay_submitted → execution_failed → retry_requested → retry_succeeded
```

### Replay Rejection

```
message_sent → warp_message_extracted → signatures_aggregated → replay_blocked
```

### Fee Addition

```
message_sent → fee_added → warp_message_extracted → signatures_aggregated → relay_submitted → delivery_confirmed
```

## Data Structures

### ChainMeta

Identifies a chain in the context of a trace:

| Field          | Type   | Description               |
| -------------- | ------ | ------------------------- |
| `name`         | string | Human-readable chain name |
| `blockchainId` | string | Avalanche blockchain ID   |
| `subnetId`     | string | Avalanche subnet ID       |
| `evmChainId`   | number | EVM chain ID              |

### RelayerInfo

| Field     | Type   | Description            |
| --------- | ------ | ---------------------- |
| `address` | string | Relayer EVM address    |
| `txHash`  | string | Relay transaction hash |

### FeeInfo

| Field          | Type   | Description                        |
| -------------- | ------ | ---------------------------------- |
| `tokenAddress` | string | Fee token contract address         |
| `initial`      | string | Initial fee amount (BigInt string) |
| `added`        | string | Additional fee amount              |
| `total`        | string | Total fee amount                   |

### RetryInfo

| Field              | Type   | Description                |
| ------------------ | ------ | -------------------------- |
| `originalGasLimit` | number | Gas limit on first attempt |
| `retryGasLimit`    | number | Gas limit on retry attempt |
| `retryTxHash`      | string | Retry transaction hash     |

## Schema Source

All types are defined in `packages/domain/src/trace.ts` and `packages/domain/src/events.ts` using Zod v4. Generated JSON Schema files are in `packages/domain/generated/`.

See the [Trace Model reference](/architecture/trace-model) for the full schema documentation.
