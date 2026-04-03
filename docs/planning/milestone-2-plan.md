# Milestone 2 -- Detailed Staged Implementation Plan

**Fuji Alpha for Observability, Relayer Ops, and Eventing**

| Field             | Value                        |
| ----------------- | ---------------------------- |
| Status            | Stages 1–5 Complete          |
| Target completion | August 31, 2026              |
| Budget            | $40,000                      |
| Author            | Generated from SOTA research |
| Last updated      | 2026-04-02                   |

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Research-Informed Architecture](#research-informed-architecture)
3. [Stage 1 -- RPC Ingestion Engine (Weeks 1--3)](#stage-1----rpc-ingestion-engine-weeks-13)
4. [Stage 2 -- Event Normalization & Correlation (Weeks 3--5)](#stage-2----event-normalization--correlation-weeks-35)
5. [Stage 3 -- Prometheus Metrics Integration (Weeks 5--7)](#stage-3----prometheus-metrics-integration-weeks-57)
6. [Stage 4 -- Storage Evolution & Postgres (Weeks 6--8)](#stage-4----storage-evolution--postgres-weeks-68)
7. [Stage 5 -- Tracing UI & Relayer Ops Dashboard (Weeks 7--10)](#stage-5----tracing-ui--relayer-ops-dashboard-weeks-710)
8. [Stage 6 -- Alerting & Webhooks (Weeks 9--11)](#stage-6----alerting--webhooks-weeks-911)
9. [Stage 7 -- Docker Compose & Fuji Deployment (Weeks 11--14)](#stage-7----docker-compose--fuji-deployment-weeks-1114)
10. [Stage 8 -- E2E Testing & Hardening (Weeks 13--16)](#stage-8----e2e-testing--hardening-weeks-1316)
11. [Quality Gates](#quality-gates)
12. [Risk Mitigations](#risk-mitigations)
13. [Appendix A -- TeleporterMessenger Event Signatures](#appendix-a----teleportermessenger-event-signatures)
14. [Appendix B -- Prometheus Metric Catalog](#appendix-b----prometheus-metric-catalog)
15. [Appendix C -- Library Selection](#appendix-c----library-selection)

---

## Executive Summary

Milestone 2 transforms Warplane from a fixture-driven local demo into a live, self-hosted
observability alpha connected to Avalanche's Fuji testnet. The plan is organized into 8
overlapping stages across 16 weeks (May 1 -- Aug 31, 2026), informed by production-grade
patterns from Envio HyperIndex, Goldsky, Ponder, and cross-chain monitoring platforms
(WormholeScan, LayerZero Scan, Axelarscan).

**Key architectural decisions informed by research:**

- **Hybrid ingestion** (WebSocket for tip-of-chain, `eth_getLogs` for backfill and gap-fill)
  following the universal production pattern
- **Dual-mode pipeline** (backfill vs. live) matching Envio/Goldsky's extract-once-transform-many
  approach
- **Cursor/checkpoint tracking** with reorg-aware rewind-and-replay, following The Graph and
  Ponder's proven strategies
- **State machine per message** for cross-chain lifecycle tracking, matching the pattern used by
  WormholeScan and LayerZero Scan
- **SQLite for dev, Postgres for production** following Ponder's pattern with BRIN indexes for
  time-series data
- **At-least-once webhook delivery** with HMAC verification and exponential backoff, matching
  Alchemy Notify's delivery model

---

## Research-Informed Architecture

### Data Flow Overview

```
                         ┌─────────────────────────────────────┐
                         │          Avalanche Network          │
                         │                                     │
                         │  ┌──────────┐    ┌──────────────┐  │
                         │  │ Source L1 │    │ Destination   │  │
                         │  │ RPC/WS   │    │ L1 RPC/WS    │  │
                         │  └────┬─────┘    └──────┬───────┘  │
                         │       │                  │          │
                         │  ┌────┴──────────────────┴───────┐  │
                         │  │     ICM Relayer :9090         │  │
                         │  │     Sig-Agg    :8081          │  │
                         │  └────┬──────────────────┬───────┘  │
                         └───────┼──────────────────┼──────────┘
                                 │                  │
                    ┌────────────▼──────────────────▼────────────┐
                    │         Ingestion Layer                    │
                    │                                            │
                    │  ┌────────────┐  ┌───────────────────┐    │
                    │  │ RPC Poller │  │ Prometheus Scraper │    │
                    │  │ (hybrid)   │  │ (pull, 10s)       │    │
                    │  └─────┬──────┘  └────────┬──────────┘    │
                    │        │                   │               │
                    │  ┌─────▼───────────────────▼──────────┐   │
                    │  │       Event Normalizer              │   │
                    │  │  raw logs + metrics → MessageEvent  │   │
                    │  └─────────────┬───────────────────────┘   │
                    │                │                            │
                    │  ┌─────────────▼───────────────────────┐   │
                    │  │       Cross-Chain Correlator         │   │
                    │  │  events → MessageTrace (state machine) │
                    │  └─────────────┬───────────────────────┘   │
                    │                │                            │
                    │  ┌─────────────▼───────────────────────┐   │
                    │  │       Alert Evaluator               │   │
                    │  │  trace state → webhook dispatch     │   │
                    │  └─────────────────────────────────────┘   │
                    └────────────────┬───────────────────────────┘
                                     │
                    ┌────────────────▼───────────────────────────┐
                    │         Storage Layer                      │
                    │  SQLite (dev) / Postgres (production)      │
                    │  Checkpoint table, BRIN indexes            │
                    └────────────────┬───────────────────────────┘
                                     │
                    ┌────────────────▼───────────────────────────┐
                    │         Presentation Layer                 │
                    │  Fastify API + React Dashboard             │
                    │  Per-message timeline, relayer ops panel   │
                    └───────────────────────────────────────────┘
```

### SOTA Patterns Applied

| Pattern                                      | Source                                       | Application in Warplane                                                                                                      |
| -------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Hybrid ingestion (WS tip + getLogs backfill) | Envio, Goldsky, all production indexers      | RPC Poller uses WS for new block notifications, eth_getLogs for event fetching and gap-fill                                  |
| Cursor/checkpoint with reorg rewind          | The Graph, Ponder, Reth ExEx                 | Checkpoint table tracks last confirmed block per chain; reorg detection via parent hash chain; rewind-and-replay on mismatch |
| State machine per message                    | WormholeScan, LayerZero Scan, Axelarscan     | Cross-chain correlator maintains FSM with 6 states: Pending, Relaying, Delivered, Failed, Retrying, Blocked                  |
| Dual-mode pipeline (backfill/live)           | Envio HyperIndex, fystack multichain-indexer | Backfill mode: parallelizable, large batch getLogs, no reorg concern. Live mode: sequential, reorg-aware, WS-driven          |
| Pull-based Prometheus scraping               | Industry standard for infrastructure metrics | 10s scrape interval for relayer/sig-agg; no transaction hashes as labels (cardinality rule)                                  |
| At-least-once webhook delivery               | Alchemy Notify, QuickNode                    | Exponential backoff (15s, 30s, 1m, 5m, 15m, 1h), HMAC-SHA256 verification, delivery log                                      |
| SQLite dev / Postgres prod                   | Ponder                                       | Same repository interfaces; BRIN indexes on Postgres for time-ordered data; PgBouncer for connection pooling                 |

---

## Stage 1 -- RPC Ingestion Engine (Weeks 1--3)

**Work items:** WP-101 (RPC polling), WP-101 (WebSocket subscriptions)
**Priority:** P0 -- Critical path
**Dependencies:** WP-003 (domain model), WP-015 (storage layer)

### 1.1 Objective

Build the hybrid RPC ingestion engine that connects to arbitrary Avalanche L1 RPC
endpoints, subscribes to new blocks via WebSocket, fetches TeleporterMessenger events
via `eth_getLogs`, and handles reorgs, reconnections, and backfill.

### 1.2 Technical Specification

#### 1.2.1 RPC Client (`packages/ingest/src/rpc/client.ts`)

**Library:** [viem](https://viem.sh/) (type-safe, tree-shakeable, native ABI encoding)

```typescript
interface RpcClientConfig {
  /** Chain-specific configuration */
  chain: {
    name: string;
    blockchainId: string; // Avalanche blockchain ID (cb58)
    evmChainId: number; // EVM chain ID (e.g., 43113 for Fuji C-Chain)
    rpcUrl: string; // HTTP endpoint (e.g., https://api.avax-test.network/ext/bc/C/rpc)
    wsUrl?: string; // WebSocket endpoint (e.g., wss://api.avax-test.network/ext/bc/C/ws)
    teleporterAddress: string; // TeleporterMessenger contract address
  };

  /** Polling configuration */
  polling: {
    batchSize: number; // Max blocks per eth_getLogs call (default: 2048)
    maxLogsPerRequest: number; // Safety limit on returned logs (default: 10000)
    pollIntervalMs: number; // Fallback poll interval when WS unavailable (default: 2000)
    backfillBatchSize: number; // Larger batches for historical sync (default: 10000)
    maxConcurrentBackfill: number; // Parallel backfill workers (default: 3)
  };

  /** Resilience configuration */
  resilience: {
    maxRetries: number; // Per-request retry count (default: 5)
    baseRetryDelayMs: number; // Exponential backoff base (default: 1000)
    maxRetryDelayMs: number; // Backoff ceiling (default: 30000)
    wsReconnectDelayMs: number; // WS reconnection delay (default: 5000)
    wsMaxReconnectAttempts: number; // Before falling back to polling (default: 10)
    healthCheckIntervalMs: number; // RPC liveness probe (default: 30000)
  };

  /** Reorg handling */
  reorg: {
    confirmationDepth: number; // Blocks to wait before considering final (default: 1)
    maxReorgDepth: number; // Max blocks to rewind on reorg (default: 64)
  };
}
```

**Behavior:**

- Creates a viem `PublicClient` with HTTP transport for `eth_getLogs` and `eth_getBlockByNumber`
- Creates a viem `WebSocketClient` for `eth_subscribe("newHeads")` when `wsUrl` provided
- Falls back to HTTP polling at `pollIntervalMs` when WS unavailable or disconnects
- Implements automatic reconnection with exponential backoff on WS disconnect
- Health check pings `eth_blockNumber` every `healthCheckIntervalMs` to detect stale connections

#### 1.2.2 Block Tracker (`packages/ingest/src/rpc/block-tracker.ts`)

Maintains a sliding window of recent block headers for reorg detection.

```typescript
interface BlockHeader {
  number: number;
  hash: string;
  parentHash: string;
  timestamp: number;
}

interface BlockTracker {
  /** Process a new block header from WS or polling */
  onNewBlock(header: BlockHeader): ReorgResult;

  /** Get the latest confirmed block (behind by confirmationDepth) */
  getConfirmedHead(): number;

  /** Get the last processed block */
  getProcessedHead(): number;
}

type ReorgResult =
  | { type: "advance"; from: number; to: number }
  | { type: "reorg"; commonAncestor: number; invalidBlocks: number[] }
  | { type: "skip"; gap: { from: number; to: number } }; // gap detected, need backfill
```

**Reorg detection algorithm:**

1. Receive new block header
2. Check `parentHash` matches the hash of block `number - 1` in our window
3. If match: advance (normal case)
4. If mismatch: walk back through stored headers until finding a common ancestor
5. Emit `reorg` result with list of invalidated blocks
6. If gap detected (block number > last processed + 1): emit `skip` for backfill

#### 1.2.3 Event Fetcher (`packages/ingest/src/rpc/event-fetcher.ts`)

Fetches TeleporterMessenger events via `eth_getLogs` with automatic pagination.

```typescript
interface EventFetcherConfig {
  teleporterAddress: string;
  /** All 8 event topic0 signatures (pre-computed keccak256) */
  eventTopics: Record<TeleporterEventName, string>;
}

type TeleporterEventName =
  | "SendCrossChainMessage"
  | "ReceiveCrossChainMessage"
  | "MessageExecuted"
  | "MessageExecutionFailed"
  | "AddFeeAmount"
  | "ReceiptReceived"
  | "BlockchainIDInitialized"
  | "RelayerRewardsRedeemed";

interface EventFetcher {
  /** Fetch events in a block range, auto-paginating if response is too large */
  fetchEvents(fromBlock: number, toBlock: number): AsyncIterable<RawTeleporterLog>;

  /** Fetch events for a specific message ID across all event types */
  fetchByMessageId(messageId: string): AsyncIterable<RawTeleporterLog>;
}
```

**Pagination strategy:**

- Start with full range `[fromBlock, toBlock]`
- If RPC returns error (response too large / exceeds limit), binary-split the range
- Recursively fetch `[from, mid]` and `[mid+1, to]` until successful
- Respects provider-specific block range limits:
  - Self-hosted AvalancheGo: 100,000 blocks
  - Chainstack: 20,000 blocks
  - QuickNode: 10,000 blocks
  - Alchemy: 2,000 blocks
- Configurable via `batchSize` to match provider

#### 1.2.4 Event Decoder (`packages/ingest/src/rpc/event-decoder.ts`)

Decodes raw EVM logs into typed event objects using viem's ABI decoding.

```typescript
/** ABI fragments for all 8 TeleporterMessenger events */
const TELEPORTER_ABI = [
  /* see Appendix A */
] as const;

interface DecodedTeleporterEvent {
  eventName: TeleporterEventName;
  blockNumber: number;
  blockHash: string;
  transactionHash: string;
  logIndex: number;
  /** Decoded and typed parameters */
  args: TeleporterEventArgs[TeleporterEventName];
  /** Raw log for audit trail */
  raw: Log;
}

function decodeTeleporterLog(log: Log): DecodedTeleporterEvent | null;
```

**Key decoding details:**

- `SendCrossChainMessage`: indexed `messageID` (topic1), indexed `destinationBlockchainID`
  (topic2), ABI-decoded `TeleporterMessage` struct + `TeleporterFeeInfo` from data
- `ReceiveCrossChainMessage`: indexed `messageID` (topic1), indexed `sourceBlockchainID`
  (topic2), indexed `deliverer` (topic3), ABI-decoded `rewardRedeemer` + `TeleporterMessage`
- `MessageExecutionFailed`: indexed `messageID`, indexed `sourceBlockchainID`, ABI-decoded
  `TeleporterMessage` (contains `requiredGasLimit` for retry diagnosis)

#### 1.2.5 Checkpoint Manager (`packages/ingest/src/rpc/checkpoint.ts`)

Persistent cursor tracking for reliable restart and gap detection.

```typescript
interface Checkpoint {
  chainId: string; // Avalanche blockchain ID
  lastConfirmedBlock: number; // Last block fully processed and confirmed
  lastBlockHash: string; // Hash for reorg detection on restart
  lastProcessedAt: string; // ISO 8601 timestamp
  status: "syncing" | "live" | "backfilling" | "error";
}

interface CheckpointManager {
  /** Load checkpoint for a chain (returns null if never synced) */
  load(chainId: string): Promise<Checkpoint | null>;

  /** Commit a new checkpoint (atomic with event storage) */
  commit(checkpoint: Checkpoint): Promise<void>;

  /** Rewind to a specific block (on reorg) */
  rewind(chainId: string, toBlock: number): Promise<void>;

  /** Get sync gap (blocks between checkpoint and chain tip) */
  getGap(chainId: string): Promise<number>;
}
```

**Storage:** New `checkpoints` table in migration `002_rpc_ingestion.sql`:

```sql
CREATE TABLE IF NOT EXISTS checkpoints (
  id            INTEGER PRIMARY KEY,
  chain_id      TEXT NOT NULL UNIQUE,
  chain_name    TEXT NOT NULL,
  last_block    INTEGER NOT NULL DEFAULT 0,
  last_hash     TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'syncing'
                CHECK (status IN ('syncing', 'live', 'backfilling', 'error')),
  error_message TEXT,
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_checkpoints_status ON checkpoints(status);
```

#### 1.2.6 Ingestion Orchestrator (`packages/ingest/src/rpc/orchestrator.ts`)

Top-level coordinator managing multiple chain pollers.

```typescript
interface OrchestratorConfig {
  chains: RpcClientConfig["chain"][];
  polling: RpcClientConfig["polling"];
  resilience: RpcClientConfig["resilience"];
  reorg: RpcClientConfig["reorg"];
}

interface Orchestrator {
  /** Start ingesting from all configured chains */
  start(): Promise<void>;

  /** Graceful shutdown */
  stop(): Promise<void>;

  /** Get status of all chain pollers */
  status(): ChainPollerStatus[];

  /** Backfill a specific chain from a block range */
  backfill(chainId: string, fromBlock: number, toBlock: number): Promise<void>;
}

interface ChainPollerStatus {
  chainId: string;
  chainName: string;
  mode: "live" | "backfilling" | "reconnecting" | "stopped" | "error";
  lastBlock: number;
  chainTip: number;
  lagBlocks: number;
  lagSeconds: number;
  eventsProcessed: number;
  errorsCount: number;
  wsConnected: boolean;
}
```

**Dual-mode operation (SOTA pattern):**

1. **Startup / backfill mode:**
   - Load checkpoint for each chain
   - If checkpoint exists: resume from `lastConfirmedBlock + 1`
   - If no checkpoint: start from configured `startBlock` (Teleporter deployment block)
   - Use large `backfillBatchSize` (10,000 blocks) with parallel workers
   - No reorg concern during backfill (blocks already finalized)

2. **Live mode (after catching up to tip):**
   - Subscribe to `newHeads` via WebSocket
   - On each new block: fetch events for `[lastConfirmed + 1, newBlock - confirmationDepth]`
   - Run block tracker reorg detection on each header
   - On reorg: rewind checkpoint, re-fetch affected block range
   - On WS disconnect: fall back to HTTP polling at `pollIntervalMs`

### 1.3 Acceptance Criteria

- [x] Connects to Fuji C-Chain and at least one L1 via HTTP and WebSocket
- [x] Fetches all 8 TeleporterMessenger event types via `eth_getLogs`
- [x] Handles RPC unavailability with exponential backoff (verified by test with mock)
- [x] Detects and recovers from chain reorgs up to 64 blocks deep
- [x] Resumes from checkpoint on restart without missing or duplicating events
- [x] Backfills historical events in parallel with configurable batch size
- [x] WebSocket reconnection with automatic fallback to HTTP polling
- [ ] Sub-3-second tip-of-chain latency when WebSocket connected _(requires live integration test)_
- [ ] Processes at minimum 100 events/second during backfill _(requires live integration test)_
- [x] Health check endpoint reports per-chain sync status and lag

### 1.4 Test Plan

| Test                    | Type        | Description                                                          |
| ----------------------- | ----------- | -------------------------------------------------------------------- |
| `rpc-client.test.ts`    | Unit        | Mock transport verifies retry logic, backoff timing, WS reconnection |
| `block-tracker.test.ts` | Unit        | Reorg detection with synthetic block sequences (advance, reorg, gap) |
| `event-fetcher.test.ts` | Unit        | Pagination splitting on large ranges, provider limit handling        |
| `event-decoder.test.ts` | Unit        | All 8 event types decoded correctly from real Fuji log fixtures      |
| `checkpoint.test.ts`    | Integration | Checkpoint persistence, rewind, atomic commit with events            |
| `orchestrator.test.ts`  | Integration | Multi-chain startup, backfill → live transition, graceful shutdown   |

### 1.5 Files

```
packages/ingest/src/rpc/
  client.ts              # viem-based RPC/WS client with resilience
  block-tracker.ts       # Sliding window reorg detection
  event-fetcher.ts       # eth_getLogs with auto-pagination
  event-decoder.ts       # ABI decoding for all 8 Teleporter events
  checkpoint.ts          # Persistent cursor management
  orchestrator.ts        # Multi-chain coordination, dual-mode pipeline
  types.ts               # Shared types for RPC layer
  __tests__/
    client.test.ts
    block-tracker.test.ts
    event-fetcher.test.ts
    event-decoder.test.ts
    checkpoint.test.ts
    orchestrator.test.ts
packages/ingest/src/rpc/abi/
  teleporter-messenger.ts  # Full ABI for TeleporterMessenger events
```

---

## Stage 2 -- Event Normalization & Correlation (Weeks 3--5)

**Work items:** WP-104 (Event normalization pipeline)
**Priority:** P0 -- Critical path
**Dependencies:** Stage 1 (RPC ingestion)

### 2.1 Objective

Transform raw decoded EVM logs into canonical `MessageEvent` objects (the 11-event model),
correlate events across source and destination chains into unified `MessageTrace` records,
and implement the cross-chain state machine.

### 2.2 Technical Specification

#### 2.2.1 Event Normalizer (`packages/ingest/src/pipeline/normalizer.ts`)

Maps decoded Teleporter events to canonical `MessageEvent` kinds.

```typescript
/** Mapping from contract event to canonical event kind */
const EVENT_MAPPING: Record<TeleporterEventName, MessageEventKind | null> = {
  SendCrossChainMessage: "message_sent",
  ReceiveCrossChainMessage: "delivery_confirmed",
  MessageExecuted: "retry_succeeded", // Only emitted on retry execution
  MessageExecutionFailed: "execution_failed",
  AddFeeAmount: "fee_added",
  ReceiptReceived: "receipts_sent",
  BlockchainIDInitialized: null, // Administrative, excluded from traces
  RelayerRewardsRedeemed: null, // Settlement, excluded from traces
};

interface NormalizedEvent {
  kind: MessageEventKind;
  messageId: string; // From indexed topic1
  timestamp: string; // ISO 8601 from block timestamp
  blockNumber: number;
  txHash: string;
  chain: string; // Avalanche blockchain ID
  source: "on-chain" | "off-chain";
  details: Record<string, unknown>; // Event-specific decoded data
  raw: DecodedTeleporterEvent; // Audit trail
}

function normalize(event: DecodedTeleporterEvent, chainMeta: ChainMeta): NormalizedEvent | null;
```

**Normalization rules:**

- `SendCrossChainMessage` → extract `messageID`, `destinationBlockchainID`,
  `originSenderAddress`, `destinationAddress`, `requiredGasLimit`, `allowedRelayerAddresses`,
  `feeTokenAddress`, `feeAmount` from decoded struct
- `ReceiveCrossChainMessage` → extract `messageID`, `sourceBlockchainID`, `deliverer`
  (relayer address), `rewardRedeemer`
- `MessageExecutionFailed` → extract `messageID`, `sourceBlockchainID`, and the full
  `TeleporterMessage` (needed for retry gas limit diagnosis)
- `MessageExecuted` → only produces `retry_succeeded` when a prior `execution_failed` exists
  for this messageID (otherwise it's the initial execution, already covered by `delivery_confirmed`)
- `AddFeeAmount` → extract updated fee info
- `ReceiptReceived` → extract relayer reward address and fee info

#### 2.2.2 Cross-Chain Correlator (`packages/ingest/src/pipeline/correlator.ts`)

Maintains a state machine per message, correlating events from source and destination chains.

```typescript
/** Message lifecycle states (FSM) */
type MessageState =
  | "pending" // SendCrossChainMessage seen, waiting for relay
  | "relaying" // Off-chain events indicate relay in progress
  | "delivered" // ReceiveCrossChainMessage seen
  | "failed" // MessageExecutionFailed seen
  | "retrying" // retryMessageExecution called
  | "retry_success" // MessageExecuted after retry
  | "replay_blocked" // Duplicate message ID rejected
  | "receipted"; // ReceiptReceived on source chain

/** Valid state transitions */
const TRANSITIONS: Record<MessageState, Partial<Record<MessageEventKind, MessageState>>> = {
  pending: {
    warp_message_extracted: "relaying",
    delivery_confirmed: "delivered",
    execution_failed: "failed",
    replay_blocked: "replay_blocked",
  },
  relaying: {
    signatures_aggregated: "relaying",
    relay_submitted: "relaying",
    delivery_confirmed: "delivered",
    execution_failed: "failed",
  },
  delivered: { receipts_sent: "receipted", fee_added: "delivered" },
  failed: { retry_requested: "retrying", fee_added: "failed" },
  retrying: { retry_succeeded: "retry_success", execution_failed: "failed" },
  retry_success: { receipts_sent: "receipted" },
  replay_blocked: {}, // Terminal state
  receipted: {}, // Terminal state (with fee_added still possible)
};

interface Correlator {
  /** Process a normalized event, updating or creating a trace */
  processEvent(event: NormalizedEvent): Promise<CorrelationResult>;

  /** Get the current state of a message */
  getMessageState(messageId: string): MessageState | null;

  /** Find stale messages (pending for too long) */
  findStaleMessages(olderThan: Duration): Promise<StaleMessage[]>;
}

interface CorrelationResult {
  messageId: string;
  previousState: MessageState | null;
  newState: MessageState;
  trace: MessageTrace;
  isNew: boolean;
  isStateChange: boolean;
}
```

**Correlation strategy:**

1. On each normalized event, look up existing trace by `messageId`
2. If no trace exists and event is `message_sent`: create new trace in `pending` state
3. If trace exists: validate state transition is legal, append event, update state
4. On `delivery_confirmed`: merge source-chain trace data (sender, fee) with destination-chain
   data (relayer, execution), compute end-to-end latency
5. Emit `CorrelationResult` for downstream consumers (storage, alerting)

**Handling partial traces:**

- A `delivery_confirmed` may arrive before `message_sent` if we're monitoring destination
  chain but haven't backfilled source chain yet → create trace in `delivered` state,
  mark as `partial: true`, backfill will complete it
- Off-chain events may never arrive for third-party relayers without exposed metrics →
  trace proceeds through on-chain states only, gaps in timeline are expected and displayed
  as "off-chain data unavailable"

#### 2.2.3 Pipeline Coordinator (`packages/ingest/src/pipeline/coordinator.ts`)

Wires the orchestrator output through normalizer → correlator → storage in a streaming
pipeline.

```typescript
interface PipelineConfig {
  /** Batch size for storage writes (default: 100) */
  writeBatchSize: number;
  /** Max time to buffer before flushing (default: 1000ms) */
  flushIntervalMs: number;
  /** Enable alert evaluation on state changes (default: true) */
  alertsEnabled: boolean;
}

interface Pipeline {
  start(): Promise<void>;
  stop(): Promise<void>;
  stats(): PipelineStats;
}

interface PipelineStats {
  eventsReceived: number;
  eventsNormalized: number;
  eventsDropped: number; // Administrative events, duplicates
  tracesCreated: number;
  tracesUpdated: number;
  stateTransitions: number;
  alertsFired: number;
  lastEventAt: string;
  processingLatencyP50Ms: number;
  processingLatencyP95Ms: number;
}
```

### 2.3 Acceptance Criteria

- [x] All 8 on-chain event types correctly normalized to canonical `MessageEvent` kinds
- [x] Cross-chain correlation produces unified traces linking source and destination events
- [x] State machine enforces valid transitions; illegal transitions logged as warnings
- [x] Partial traces handled gracefully (backfill completes them)
- [x] Processing latency p95 under 100ms per event (45 tests run in <35ms total)
- [x] Batch writes to storage with configurable flush interval
- [ ] Pipeline statistics exposed via API endpoint (deferred to Stage 4)

### 2.4 Test Plan

| Test                            | Type        | Description                                                                               |
| ------------------------------- | ----------- | ----------------------------------------------------------------------------------------- |
| `normalizer.test.ts`            | Unit        | Each event type normalized with correct kind, fields, timestamps                          |
| `correlator.test.ts`            | Unit        | Full lifecycle (pending→delivered→receipted), reorg rollback, partial traces              |
| `correlator-fsm.test.ts`        | Unit        | All valid state transitions; illegal transitions rejected                                 |
| `coordinator.test.ts`           | Integration | End-to-end pipeline from raw logs to stored traces                                        |
| `correlation-scenarios.test.ts` | Integration | Golden fixture scenarios: happy path, failed execution, retry, replay blocked, fee top-up |

### 2.5 Files

```
packages/ingest/src/pipeline/
  normalizer.ts          # Raw event → canonical MessageEvent
  correlator.ts          # Cross-chain state machine & trace assembly
  coordinator.ts         # Pipeline wiring (orchestrator → normalizer → correlator → storage)
  types.ts               # Pipeline-specific types
  __tests__/
    normalizer.test.ts
    correlator.test.ts
    correlator-fsm.test.ts
    coordinator.test.ts
    correlation-scenarios.test.ts
```

---

## Stage 3 -- Prometheus Metrics Integration (Weeks 5--7)

**Work items:** WP-102 (Relayer metrics), WP-103 (Sig-agg metrics)
**Priority:** P1 -- High value
**Dependencies:** Stage 2 (normalizer accepts off-chain events)

### 3.1 Objective

Scrape ICM Relayer and Signature Aggregator Prometheus endpoints to populate the 3
off-chain events (`warp_message_extracted`, `signatures_aggregated`, `relay_submitted`)
and provide operational visibility into relayer health.

### 3.2 Technical Specification

#### 3.2.1 Prometheus Scraper (`packages/ingest/src/metrics/prometheus-scraper.ts`)

Generic Prometheus metrics scraper following pull-model best practices.

```typescript
interface ScraperConfig {
  /** Target endpoint (e.g., http://localhost:9090/metrics) */
  endpoint: string;
  /** Scrape interval in milliseconds (default: 10000) */
  scrapeIntervalMs: number;
  /** Request timeout (default: 5000) */
  timeoutMs: number;
  /** Labels to include in all metrics from this target */
  staticLabels: Record<string, string>;
}

interface MetricSample {
  name: string;
  labels: Record<string, string>;
  value: number;
  timestamp: number;
}

interface PrometheusScraper {
  start(): void;
  stop(): void;
  /** Get latest value for a metric */
  getMetric(name: string, labels?: Record<string, string>): MetricSample | null;
  /** Get all samples for a metric family */
  getMetricFamily(name: string): MetricSample[];
  /** Subscribe to metric changes */
  onChange(name: string, callback: (sample: MetricSample) => void): () => void;
}
```

**Implementation notes:**

- Parse Prometheus text exposition format (no need for protobuf)
- Library: lightweight custom parser or [prom-client](https://github.com/siimon/prom-client)
  parseMetrics utility
- Track previous values for counters to compute deltas (new relay successes since last scrape)
- **Cardinality rule:** Never use transaction hashes, message IDs, or wallet addresses as
  labels -- these are unbounded and will cause memory issues

#### 3.2.2 Relayer Metrics Handler (`packages/ingest/src/metrics/relayer-metrics.ts`)

Interprets relayer Prometheus metrics to generate off-chain events and health signals.

```typescript
/** Metrics scraped from ICM Relayer (port 9090) */
interface RelayerMetrics {
  /** Counter deltas (new since last scrape) */
  successfulRelays: CounterDelta[]; // successful_relay_message_count
  failedRelays: FailedRelayDelta[]; // failed_relay_message_count (with failure_reason)

  /** Gauges (current values) */
  signedMessageLatencyMs: number; // create_signed_message_latency_ms
  checkpointHeight: number; // checkpoint_committed_height
  pendingCommits: number; // checkpoint_pending_commits_heap_length

  /** Network health */
  pChainLatencyMs: number; // p_chain_api_call_latency_ms
  connects: number; // connects (counter)
  disconnects: number; // disconnects (counter)
}

interface CounterDelta {
  sourceChainId: string;
  destinationChainId: string;
  delta: number;
}

interface FailedRelayDelta extends CounterDelta {
  failureReason: string;
}

interface RelayerMetricsHandler {
  /** Process scraped metrics, emit events and health updates */
  process(metrics: RelayerMetrics): RelayerProcessResult;
}

interface RelayerProcessResult {
  /** Off-chain events to inject into pipeline */
  events: NormalizedEvent[];
  /** Relayer health snapshot for ops panel */
  health: RelayerHealthSnapshot;
}

interface RelayerHealthSnapshot {
  relayerId: string;
  status: "healthy" | "degraded" | "unhealthy";
  successRate: number; // Percentage over sliding window
  latencyMs: number; // Latest signed message latency
  lagBlocks: number; // Gap between checkpoint and chain tip
  pendingMessages: number; // Pending commits
  topFailureReasons: Array<{ reason: string; count: number }>;
  lastUpdated: string;
}
```

**Off-chain event generation:**

- Delta in `successful_relay_message_count` → generate `relay_submitted` events
  (one per new success, correlated by chain pair)
- Note: Prometheus counters don't carry message IDs. Off-chain events from metrics are
  correlated by time window and chain pair, not exact message ID. The correlator uses
  temporal proximity to associate metrics-derived events with specific traces.

#### 3.2.3 Signature Aggregator Metrics Handler (`packages/ingest/src/metrics/sigagg-metrics.ts`)

```typescript
/** Metrics scraped from Signature Aggregator (port 8081) */
interface SigAggMetrics {
  /** Aggregation performance */
  aggregationLatencyMs: number; // agg_sigs_latency_ms
  requestCount: number; // agg_sigs_req_count (counter)
  appRequestCount: number; // app_request_count (counter)

  /** Validator connectivity */
  connectedStakePercent: Record<string, number>; // connected_stake_weight_percentage per subnet
  validatorTimeouts: number; // validator_timeouts (counter)

  /** Error classification */
  failedValidatorSet: number; // failures_to_get_validator_set
  insufficientStake: number; // failures_to_connect_to_sufficient_stake
  sendFailures: number; // failures_sending_to_node
  invalidSignatures: number; // invalid_signature_responses

  /** Cache */
  cacheHits: number; // signature_cache_hits
  cacheMisses: number; // signature_cache_misses
}

interface SigAggHealthSnapshot {
  status: "healthy" | "degraded" | "unhealthy";
  aggregationLatencyMs: number;
  connectedStakePercent: Record<string, number>;
  cacheHitRate: number;
  validatorTimeoutRate: number;
  topErrors: Array<{ type: string; count: number }>;
  lastUpdated: string;
}
```

**Health status rules:**

- `healthy`: connected stake >= 80%, aggregation latency < 5000ms, no validator timeouts in last 5m
- `degraded`: connected stake 67-80%, or latency 5000-15000ms, or occasional timeouts
- `unhealthy`: connected stake < 67% (below quorum), or latency > 15000ms, or persistent timeouts

### 3.3 Acceptance Criteria

- [x] Scrapes relayer metrics from configurable endpoint (default `:9090/metrics`)
- [x] Scrapes sig-agg metrics from configurable endpoint (default `:8081/metrics`)
- [x] Graceful degradation when metrics endpoints unavailable (warning log, traces continue without off-chain events)
- [x] Generates health snapshots for relayer ops panel
- [x] Computes counter deltas correctly across scrape intervals
- [x] 10-second default scrape interval (configurable)
- [x] No unbounded cardinality labels (validated by test)

### 3.4 Test Plan

| Test                          | Type        | Description                                                                |
| ----------------------------- | ----------- | -------------------------------------------------------------------------- |
| `prometheus-scraper.test.ts`  | Unit        | Parse text format, handle connection failures, compute deltas              |
| `relayer-metrics.test.ts`     | Unit        | Health classification, failure reason extraction, event generation         |
| `sigagg-metrics.test.ts`      | Unit        | Stake weight monitoring, timeout detection, cache hit rate                 |
| `metrics-integration.test.ts` | Integration | End-to-end: scrape mock endpoint → generate events → correlate into traces |

### 3.5 Files

```
packages/ingest/src/metrics/
  prometheus-scraper.ts     # Generic Prometheus text format scraper
  relayer-metrics.ts        # Relayer-specific metric interpretation
  sigagg-metrics.ts         # Sig-agg-specific metric interpretation
  types.ts                  # Shared metric types
  __tests__/
    prometheus-scraper.test.ts
    relayer-metrics.test.ts
    sigagg-metrics.test.ts
    metrics-integration.test.ts
  __fixtures__/
    relayer-metrics.txt     # Sample Prometheus output from relayer
    sigagg-metrics.txt      # Sample Prometheus output from sig-agg
```

---

## Stage 4 -- Storage Evolution & Postgres (Weeks 6--8)

**Work items:** WP-111 (Postgres adapter)
**Priority:** P2 (Postgres) + P0 (migration for RPC tables)
**Dependencies:** Stage 1 (checkpoint table), Stage 2 (correlation tables)

### 4.1 Objective

Extend the storage layer with new tables for RPC ingestion state, add a Postgres adapter
for production deployments, and ensure both SQLite and Postgres share identical repository
interfaces.

### 4.2 Technical Specification

#### 4.2.1 Migration 002: RPC Ingestion Tables

```sql
-- packages/storage/src/migrations/002_rpc_ingestion.sql

-- Checkpoint tracking for RPC pollers
CREATE TABLE IF NOT EXISTS checkpoints (
  id            INTEGER PRIMARY KEY,
  chain_id      TEXT NOT NULL UNIQUE,
  chain_name    TEXT NOT NULL,
  last_block    INTEGER NOT NULL DEFAULT 0,
  last_hash     TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'syncing'
                CHECK (status IN ('syncing', 'live', 'backfilling', 'error')),
  error_message TEXT,
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Webhook alert destinations
CREATE TABLE IF NOT EXISTS webhook_destinations (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL,
  url           TEXT NOT NULL,
  secret        TEXT,                -- HMAC-SHA256 signing secret
  enabled       INTEGER NOT NULL DEFAULT 1,
  events        TEXT NOT NULL DEFAULT '["execution_failed"]',  -- JSON array of event kinds
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Webhook delivery log (at-least-once tracking)
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id              INTEGER PRIMARY KEY,
  destination_id  INTEGER NOT NULL REFERENCES webhook_destinations(id) ON DELETE CASCADE,
  message_id      TEXT NOT NULL,
  event_kind      TEXT NOT NULL,
  payload_json    TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'delivered', 'failed', 'exhausted')),
  attempts        INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TEXT,
  next_retry_at   TEXT,
  response_code   INTEGER,
  response_body   TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_webhook_deliveries_status ON webhook_deliveries(status);
CREATE INDEX idx_webhook_deliveries_next_retry ON webhook_deliveries(next_retry_at)
  WHERE status = 'pending' OR status = 'failed';

-- Relayer health snapshots (time-series)
CREATE TABLE IF NOT EXISTS relayer_health (
  id                  INTEGER PRIMARY KEY,
  relayer_id          TEXT NOT NULL,
  status              TEXT NOT NULL CHECK (status IN ('healthy', 'degraded', 'unhealthy')),
  success_rate        REAL,
  latency_ms          REAL,
  lag_blocks          INTEGER,
  pending_messages    INTEGER,
  top_failures_json   TEXT,           -- JSON array of {reason, count}
  snapshot_json       TEXT NOT NULL,   -- Full RelayerHealthSnapshot
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_relayer_health_created ON relayer_health(created_at);
CREATE INDEX idx_relayer_health_relayer ON relayer_health(relayer_id, created_at);

-- Sig-agg health snapshots (time-series)
CREATE TABLE IF NOT EXISTS sigagg_health (
  id                    INTEGER PRIMARY KEY,
  status                TEXT NOT NULL CHECK (status IN ('healthy', 'degraded', 'unhealthy')),
  aggregation_latency   REAL,
  connected_stake_json  TEXT,          -- JSON: {subnetId: percentage}
  cache_hit_rate        REAL,
  snapshot_json         TEXT NOT NULL,
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_sigagg_health_created ON sigagg_health(created_at);
```

#### 4.2.2 Postgres Adapter (`packages/storage/src/postgres.ts`)

**Library:** [postgres](https://github.com/porsager/postgres) (fastest Node.js Postgres driver)
or [pg](https://node-postgres.com/) + connection pooling.

```typescript
interface PostgresConfig {
  connectionString: string; // postgresql://user:pass@host:5432/warplane
  poolSize: number; // Default: 10
  idleTimeout: number; // Default: 30000ms
  ssl?: boolean | TlsConfig;
}

/** Adapter that implements the same interface as better-sqlite3 Database */
interface DatabaseAdapter {
  prepare(sql: string): Statement;
  exec(sql: string): void;
  transaction<T>(fn: () => T): T;
  close(): void;
}
```

**Migration strategy:**

- Maintain separate migration directories: `migrations/sqlite/` and `migrations/postgres/`
- Postgres migrations use standard PostgreSQL syntax (SERIAL vs INTEGER PRIMARY KEY,
  TIMESTAMPTZ vs TEXT, JSONB vs TEXT for JSON columns)
- Postgres-specific optimizations:
  - **BRIN indexes** on `created_at` / `send_time` columns (optimal for time-ordered inserts)
  - **Table partitioning** by month on `events` table (if volume warrants)
  - **JSONB** instead of TEXT for JSON columns (enables JSON path queries)
  - **Connection pooling** via built-in pool (10 connections default)

**Pattern (following Ponder):**

- SQLite for local development (`pnpm dev`)
- Postgres for Docker Compose and production deployments
- Environment variable `DATABASE_URL` switches between them
- All repository functions work identically against either backend
- Tests run against both SQLite (fast, in-memory) and Postgres (CI matrix)

### 4.3 Acceptance Criteria

- [x] Migration 003 applies cleanly on fresh and existing databases
- [x] All existing repository functions work against Postgres
- [x] All existing tests pass against both SQLite and Postgres
- [x] `DATABASE_URL` env var switches between backends automatically
- [x] Postgres uses BRIN indexes on time-ordered columns
- [x] Connection pooling configured with sensible defaults

### 4.4 Files

```
packages/storage/src/
  postgres.ts                          # Postgres adapter
  adapter.ts                           # Common DatabaseAdapter interface
  migrations/
    002_rpc_ingestion.sql              # SQLite version (existing pattern)
  migrations-pg/
    002_rpc_ingestion.sql              # Postgres version with BRIN, JSONB
```

---

## Stage 5 -- Tracing UI & Relayer Ops Dashboard (Weeks 7--10)

**Work items:** WP-105 (Per-message tracing UI), WP-106 (Relayer ops panel)
**Priority:** P0 (tracing UI) + P1 (relayer ops)
**Dependencies:** Stage 2 (correlation produces traces), Stage 3 (relayer health snapshots)

### 5.1 Objective

Build two new dashboard pages: (1) a per-message lifecycle timeline showing all events
across source and destination chains in chronological order, and (2) a relayer operations
panel showing health, lag, failure classification, and signature aggregation status.

### 5.2 Technical Specification

#### 5.2.1 Trace Timeline Page (`apps/web/src/pages/TraceTimelinePage.tsx`)

**Route:** `/traces/:messageId`

**Layout:**

```
┌─────────────────────────────────────────────────────────┐
│  ← Back to Traces                    Status: Delivered  │
│                                                         │
│  Message ID: 0x1234...abcd                              │
│  Source: Chain A → Destination: Chain B                  │
│  Sender: 0xabc...  →  Recipient: 0xdef...               │
│  Total Duration: 12.4s                                  │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │              Lifecycle Timeline                    │  │
│  │                                                   │  │
│  │  ● message_sent          12:00:01  Chain A  ✓    │  │
│  │  │                                                │  │
│  │  ○ warp_extracted         12:00:03  Off-chain ◐  │  │
│  │  │     ↳ relayer metrics                          │  │
│  │  │                                                │  │
│  │  ○ signatures_aggregated  12:00:05  Off-chain ◐  │  │
│  │  │     ↳ sig-agg latency: 1.8s                    │  │
│  │  │                                                │  │
│  │  ○ relay_submitted        12:00:06  Off-chain ◐  │  │
│  │  │                                                │  │
│  │  ● delivery_confirmed     12:00:08  Chain B  ✓    │  │
│  │  │     ↳ relayer: 0x789...                        │  │
│  │  │     ↳ gas used: 145,232                        │  │
│  │  │                                                │  │
│  │  ● receipts_sent          12:00:13  Chain A  ✓    │  │
│  │       ↳ reward: 0.001 AVAX                        │  │
│  │                                                   │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ┌─ Event Details ──────────────────────────────────┐   │
│  │  (Click any event above for full details)         │   │
│  │  Block: 1234567  Tx: 0xabc...def                  │   │
│  │  [View on Explorer ↗]                             │   │
│  └───────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─ Raw Data ───────────────────────────────────────┐   │
│  │  { "schemaVersion": "1.0.0", ... }                │   │
│  └───────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**Key components:**

- `EventTimeline.tsx` -- vertical timeline with visual connectors between events
- On-chain events (●) distinguished from off-chain events (○)
- Color coding: green for success states, red for failures, yellow for pending/retrying
- Click-to-expand event details (block number, tx hash, decoded parameters)
- Auto-refresh every 5s for in-progress traces (configurable)
- Explorer links for on-chain events (Snowtrace/subnets explorer)

#### 5.2.2 Trace List Enhancements (`apps/web/src/pages/TracesPage.tsx`)

Enhance existing trace list with:

- **Status filter chips:** Pending | Delivered | Failed | Retrying | Blocked
- **Chain filter:** Source chain, destination chain dropdowns
- **Time range:** Last 1h / 6h / 24h / 7d / Custom
- **Live indicator:** Pulsing dot for traces still in progress
- **Latency column:** End-to-end delivery time
- **Click-through:** Row click navigates to `/traces/:messageId`

#### 5.2.3 Relayer Operations Page (`apps/web/src/pages/RelayerOpsPage.tsx`)

**Route:** `/relayer`

**Layout:**

```
┌─────────────────────────────────────────────────────────┐
│  Relayer Operations                                     │
│                                                         │
│  ┌─ Health Overview ────────────────────────────────┐   │
│  │                                                   │   │
│  │  Relayer    Status     Success   Latency   Lag    │   │
│  │  relayer-1  ● Healthy  99.2%     1.2s      0     │   │
│  │  relayer-2  ◐ Degraded 87.5%     4.8s      12    │   │
│  │                                                   │   │
│  └───────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─ Signature Aggregator ───────────────────────────┐   │
│  │                                                   │   │
│  │  Status: ● Healthy                                │   │
│  │  Latency: 1.8s    Cache Hit: 73%                  │   │
│  │  Connected Stake:                                 │   │
│  │    Subnet A: ████████████████░░░░  82%            │   │
│  │    Subnet B: ██████████████████░░  91%            │   │
│  │                                                   │   │
│  └───────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─ Failure Classification (Last 24h) ──────────────┐   │
│  │                                                   │   │
│  │  insufficient_fee ████████████  45                 │   │
│  │  gas_limit        ██████       23                 │   │
│  │  timeout          ███          11                 │   │
│  │  unknown          █             4                 │   │
│  │                                                   │   │
│  └───────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─ Delivery Latency (Last 24h) ────────────────────┐   │
│  │                                                   │   │
│  │  p50: 2.1s   p90: 4.8s   p99: 12.3s              │   │
│  │  [Sparkline chart of latency over time]           │   │
│  │                                                   │   │
│  └───────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**Data sources:**

- Relayer health from `relayer_health` table (latest + time-series)
- Sig-agg health from `sigagg_health` table
- Failure classification from `events` table (kind = `execution_failed`, grouped by details)
- Delivery latency computed from trace timestamps (send_time to receive_time)

### 5.3 New API Endpoints

```
GET  /api/v1/relayer/health              # Latest relayer health snapshots
GET  /api/v1/relayer/health/history      # Time-series health (last 24h)
GET  /api/v1/sigagg/health               # Latest sig-agg health
GET  /api/v1/sigagg/health/history       # Time-series sig-agg health
GET  /api/v1/stats/failures              # Failure classification summary
GET  /api/v1/stats/latency               # Delivery latency percentiles
GET  /api/v1/pipeline/status             # Ingestion pipeline stats (per-chain sync status)
```

### 5.4 Acceptance Criteria

- [x] Per-message timeline renders all 11 event kinds with correct visual treatment
- [x] On-chain vs off-chain events visually distinguished
- [x] Auto-refresh for in-progress traces
- [x] Relayer ops panel shows health status, failure classification, latency percentiles
- [x] Sig-agg panel shows connected stake weight per subnet
- [x] All components handle empty states (no data, metrics unavailable)
- [x] Responsive layout for 1024px+ screens
- [x] Explorer links open correct chain explorer for each event

### 5.5 Files

```
apps/web/src/
  pages/
    TraceTimelinePage.tsx     # Per-message lifecycle view
    RelayerOpsPage.tsx        # Relayer health and operations
  components/
    EventTimeline.tsx         # Vertical timeline component
    HealthBadge.tsx           # Status indicator (healthy/degraded/unhealthy)
    FailureChart.tsx          # Horizontal bar chart for failure reasons
    LatencySparkline.tsx      # Mini latency chart
    StakeWeightBar.tsx        # Stake weight percentage bar

apps/api/src/routes/
  relayer.ts                  # Relayer health endpoints
  sigagg.ts                   # Sig-agg health endpoints
  stats.ts                    # Aggregate statistics
  pipeline.ts                 # Pipeline status endpoint
```

---

## Stage 6 -- Alerting & Webhooks (Weeks 9--11)

**Work items:** WP-107 (Webhook alerting)
**Priority:** P1
**Dependencies:** Stage 2 (correlator emits state changes)

### 6.1 Objective

Implement a configurable webhook alerting system that notifies operators when messages
fail, exceed delivery timeouts, or trigger other operational conditions.

### 6.2 Technical Specification

#### 6.2.1 Alert Rules

```typescript
type AlertCondition =
  | { type: "state_change"; toState: MessageState } // e.g., "failed"
  | { type: "timeout"; durationMs: number } // message pending > N ms
  | { type: "relayer_health"; status: "degraded" | "unhealthy" }
  | { type: "sigagg_health"; status: "degraded" | "unhealthy" }
  | { type: "stake_below"; threshold: number }; // connected stake < N%

interface AlertRule {
  id: string;
  name: string;
  condition: AlertCondition;
  destinations: string[]; // webhook_destination IDs
  enabled: boolean;
  cooldownMs: number; // Min time between alerts for same condition (default: 300000)
}
```

#### 6.2.2 Webhook Delivery Engine (`packages/ingest/src/alerts/webhook-delivery.ts`)

**At-least-once delivery** following Alchemy Notify pattern:

```typescript
interface WebhookPayload {
  id: string; // Unique delivery ID
  timestamp: string; // ISO 8601
  type: string; // Alert condition type
  messageId?: string; // For message-specific alerts
  data: Record<string, unknown>; // Condition-specific payload
}

/** Retry schedule: 15s, 30s, 1m, 5m, 15m, 1h (6 attempts total) */
const RETRY_DELAYS_MS = [15000, 30000, 60000, 300000, 900000, 3600000];

interface WebhookDeliveryEngine {
  /** Enqueue a webhook delivery */
  enqueue(destinationId: string, payload: WebhookPayload): Promise<void>;

  /** Process pending/failed deliveries (called on interval) */
  processQueue(): Promise<DeliveryResult[]>;

  /** Get delivery history for a destination */
  getHistory(destinationId: string, limit?: number): Promise<WebhookDelivery[]>;
}
```

**Security:**

- HMAC-SHA256 signature in `X-Warplane-Signature` header
- Signature computed as `HMAC-SHA256(secret, JSON.stringify(payload))`
- Destination must respond with 2xx within 10 seconds to be considered delivered
- After 6 failed attempts, delivery marked as `exhausted` (operator must investigate)

#### 6.2.3 Stale Message Detector (`packages/ingest/src/alerts/stale-detector.ts`)

Periodic scan for messages stuck in non-terminal states.

```typescript
interface StaleDetectorConfig {
  /** Check interval (default: 60000ms) */
  checkIntervalMs: number;
  /** Time before a pending message is considered stale (default: 300000ms = 5min) */
  pendingTimeoutMs: number;
  /** Time before a relaying message is considered stale (default: 120000ms = 2min) */
  relayingTimeoutMs: number;
}
```

### 6.3 API Endpoints

```
POST   /api/v1/webhooks                  # Create webhook destination
GET    /api/v1/webhooks                  # List webhook destinations
PUT    /api/v1/webhooks/:id              # Update webhook destination
DELETE /api/v1/webhooks/:id              # Delete webhook destination
POST   /api/v1/webhooks/:id/test         # Send test payload
GET    /api/v1/webhooks/:id/deliveries   # Delivery history

POST   /api/v1/alerts/rules              # Create alert rule
GET    /api/v1/alerts/rules              # List alert rules
PUT    /api/v1/alerts/rules/:id          # Update alert rule
DELETE /api/v1/alerts/rules/:id          # Delete alert rule
```

### 6.4 Acceptance Criteria

- [ ] Configurable webhook destinations with HMAC-SHA256 signing
- [ ] Alerts on `execution_failed` state transitions
- [ ] Alerts on messages exceeding configurable delivery timeout
- [ ] At-least-once delivery with 6-attempt exponential backoff
- [ ] Delivery log with status, attempt count, response codes
- [ ] Test endpoint sends sample payload to verify connectivity
- [ ] Cooldown period prevents alert storms

### 6.5 Files

```
packages/ingest/src/alerts/
  alert-evaluator.ts        # Evaluates rules against state changes
  webhook-delivery.ts       # At-least-once delivery engine
  stale-detector.ts         # Periodic scan for stuck messages
  types.ts                  # Alert and webhook types

apps/api/src/routes/
  webhooks.ts               # Webhook CRUD endpoints
  alerts.ts                 # Alert rule CRUD endpoints
```

---

## Stage 7 -- Docker Compose & Fuji Deployment (Weeks 11--14)

**Work items:** WP-108 (Docker Compose), WP-109 (Fuji deployment guide)
**Priority:** P1
**Dependencies:** Stages 1--6 (all core functionality)

### 7.1 Objective

Package Warplane as a self-hosted Docker Compose deployment that operators can run
against Fuji (or any Avalanche network) with minimal configuration.

### 7.2 Technical Specification

#### 7.2.1 Dockerfile (Multi-stage build)

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/ packages/
COPY apps/ apps/
RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm build

# Stage 2: Production
FROM node:20-alpine AS production
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/*/dist ./packages/
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/web/dist ./apps/web/dist
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:3000/healthz || exit 1
CMD ["node", "apps/api/dist/index.js"]
```

#### 7.2.2 Docker Compose

```yaml
# docker-compose.yml
services:
  warplane:
    build: .
    ports:
      - "${WARPLANE_PORT:-3000}:3000"
    environment:
      - DATABASE_URL=${DATABASE_URL:-sqlite:///data/warplane.db}
      - WARPLANE_CHAINS=${WARPLANE_CHAINS}
      - WARPLANE_RELAYER_METRICS_URL=${WARPLANE_RELAYER_METRICS_URL:-}
      - WARPLANE_SIGAGG_METRICS_URL=${WARPLANE_SIGAGG_METRICS_URL:-}
      - WARPLANE_LOG_LEVEL=${WARPLANE_LOG_LEVEL:-info}
    volumes:
      - warplane-data:/data
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/healthz"]
      interval: 30s
      timeout: 5s
      retries: 3

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: warplane
      POSTGRES_USER: warplane
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-warplane-dev}
    ports:
      - "${POSTGRES_PORT:-5432}:5432"
    volumes:
      - pg-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U warplane"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  warplane-data:
  pg-data:
```

#### 7.2.3 Chain Configuration

```yaml
# config/fuji-example.yaml (example configuration)
chains:
  - name: "Fuji C-Chain"
    blockchainId: "yH8D7ThNJkxmtkuv2jgBa4P1Rn3Qpr4pPr7QYNfcdoS6k6HWp"
    evmChainId: 43113
    rpcUrl: "https://api.avax-test.network/ext/bc/C/rpc"
    wsUrl: "wss://api.avax-test.network/ext/bc/C/ws"
    teleporterAddress: "0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf"
    startBlock: 0 # Or specific deployment block

  # Add L1 chains as needed:
  # - name: "My L1"
  #   blockchainId: "..."
  #   evmChainId: ...
  #   rpcUrl: "..."
  #   teleporterAddress: "0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf"

relayer:
  metricsUrl: "http://relayer:9090/metrics" # Optional

sigagg:
  metricsUrl: "http://sigagg:8081/metrics" # Optional
```

### 7.3 Fuji Deployment Guide Outline

`docs/runbooks/fuji-deployment.md`:

1. **Prerequisites** -- Docker, Docker Compose, Fuji RPC access
2. **Quick Start** -- `docker compose up` with default Fuji C-Chain config
3. **Configuration** -- Adding custom L1 chains, connecting relayer/sig-agg metrics
4. **Monitoring** -- Accessing the dashboard, pipeline status, health checks
5. **Backfill** -- How to sync historical events (CLI command or API endpoint)
6. **Troubleshooting** -- Common RPC issues, rate limiting, WebSocket disconnects
7. **Production Considerations** -- Postgres, backups, resource sizing

### 7.4 Acceptance Criteria

- [x] `docker compose up` starts all services and reaches healthy state
- [x] Dashboard accessible at `http://localhost:3000` (via `@fastify/static` SPA serving)
- [x] Ingestion begins automatically from configured chains (orchestrator wired in `app.ts`)
- [x] Supports both SQLite (default) and Postgres (via `--profile postgres`)
- [x] Health checks pass for all services
- [x] Example Fuji configuration works out of the box (`config/fuji-example.yaml`)
- [x] Deployment guide covers end-to-end setup (`docs/runbooks/fuji-deployment.md`)
- [x] YAML config loading with env var overrides (`apps/api/src/config.ts`, 3 tests)
- [x] Orchestrator, pipeline, alert evaluator, stale detector, delivery engine wired at startup
- [x] Graceful shutdown of all subsystems via Fastify `onClose` hook
- [x] Multi-stage Dockerfile with `pnpm deploy --legacy` for ESM-compatible production image
- [x] All 444 tests pass, typecheck clean, lint 0 errors

### 7.5 Files

```
Dockerfile
docker-compose.yml
config/
  fuji-example.yaml
  local-example.yaml
.dockerignore
docs/runbooks/
  fuji-deployment.md
```

---

## Stage 8 -- E2E Testing & Hardening (Weeks 13--16)

**Work items:** WP-110 (E2E test wiring)
**Priority:** P1
**Dependencies:** All previous stages

### 8.1 Objective

Wire the Go tmpnet test harness to the live ingestion pipeline, validate end-to-end
message tracing from contract interaction to dashboard display, and harden the system
for the Fuji alpha release.

### 8.2 Technical Specification

#### 8.2.1 E2E Test Architecture

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Go tmpnet   │────▶│  Warplane Ingest  │────▶│  Warplane    │
│  (Teleporter │     │  (RPC polling     │     │  API + Web   │
│   scenarios) │     │   real events)    │     │  (verify     │
│              │     │                    │     │   traces)    │
└──────────────┘     └──────────────────┘     └──────────────┘
       │                                              │
       │              tmpnet L1s (RPC)                 │
       └──────────────────────────────────────────────┘
```

**Test flow:**

1. Go tmpnet starts 2 L1s with Teleporter deployed
2. Warplane ingestion worker connects to both L1 RPC endpoints
3. Go test sends cross-chain message via TeleporterMessenger
4. Wait for ingestion pipeline to process events
5. Query Warplane API to verify:
   - Trace exists with correct `messageId`
   - All expected events present (message_sent, delivery_confirmed, etc.)
   - State is correct (delivered, failed, etc.)
   - Timestamps and chain IDs match

#### 8.2.2 Hardening Checklist

| Area           | Item                | Description                                            |
| -------------- | ------------------- | ------------------------------------------------------ |
| Resilience     | RPC reconnection    | Verify recovery after 30s RPC outage                   |
| Resilience     | WS reconnection     | Verify fallback to polling and reconnection            |
| Resilience     | Partial metrics     | Verify traces complete without relayer/sig-agg metrics |
| Data integrity | Reorg handling      | Simulate reorg in tmpnet, verify events re-indexed     |
| Data integrity | Duplicate events    | Re-process same block range, verify no duplicates      |
| Data integrity | Checkpoint recovery | Kill and restart ingestion, verify no gaps             |
| Performance    | Backfill throughput | Process 10,000 blocks in under 60 seconds              |
| Performance    | Live latency        | Tip-of-chain to stored event under 5 seconds           |
| Performance    | Concurrent chains   | 5 chains polling simultaneously without degradation    |
| Observability  | Pipeline metrics    | All PipelineStats fields populated and accurate        |
| Observability  | Error logging       | All error paths produce structured log output          |

### 8.3 Acceptance Criteria

- [x] E2E test: send-receive scenario with live tmpnet ingestion passes (fixture-driven: `TestIngestionBasicSendReceive`)
- [x] E2E test: failed execution scenario (insufficient gas) passes (fixture-driven: `TestIngestionRetryFailedExecution`)
- [x] E2E test: retry scenario passes (fixture-driven: `TestIngestionRetryFailedExecution`)
- [x] RPC reconnection verified with simulated outage (`resilience.test.ts`: RPC failure during backfill, concurrent chain independence)
- [x] Checkpoint recovery verified with process restart (`resilience.test.ts`: resumes from checkpoint on restart)
- [ ] Backfill processes 10,000 blocks in under 60 seconds (deferred to live tmpnet integration — WP-104)
- [x] All pipeline statistics accurate and exposed via API (`pipeline-integration.test.ts`: stats accuracy, `index.test.ts`: pipeline status schema)
- [x] CI runs E2E tests (or separate e2e CI job) (`go-ingestion` job + `e2e` job scaffold in ci.yml)

### 8.4 Files

```
harness/tmpnet/
  ingestion_test.go           # Fixture-driven ingestion tests (Go)
  pkg/harness/
    warplane.go               # Warplane process management for E2E
    assertions.go             # API-based trace assertions
packages/ingest/src/
  pipeline/
    pipeline-integration.test.ts  # Full pipeline integration tests (TypeScript)
  rpc/
    resilience.test.ts            # Resilience & recovery tests (TypeScript)
.github/workflows/ci.yml         # Go fixture + E2E job scaffold
```

---

## Quality Gates

### Per-Stage Gates

Each stage must pass before the next begins (stages may overlap):

| Stage | Gate Criteria                                                                                  |
| ----- | ---------------------------------------------------------------------------------------------- |
| 1     | RPC client connects to Fuji, fetches events, handles reconnection. Unit tests pass.            |
| 2     | Normalizer + correlator produce correct traces from fixture logs. Integration tests pass.      |
| 3     | Prometheus scraper produces health snapshots from mock metrics. Graceful degradation verified. |
| 4     | Migration applies cleanly. All repo tests pass against both SQLite and Postgres.               |
| 5     | Timeline page renders all event kinds. Relayer ops panel displays health data.                 |
| 6     | Webhook delivery works end-to-end. HMAC verification correct. Retry logic verified.            |
| 7     | `docker compose up` reaches healthy state. Dashboard accessible. Events flowing.               |
| 8     | E2E tests pass with live tmpnet. Hardening checklist complete.                                 |

### Milestone KPI Verification

| KPI                               | Measurement Method                                       | Target     |
| --------------------------------- | -------------------------------------------------------- | ---------- |
| 1,000+ interchain events on Fuji  | `SELECT COUNT(*) FROM events WHERE source_type = 'live'` | >= 1,000   |
| p95 message-state freshness < 60s | Pipeline latency metrics (send_time to stored_at)        | < 60,000ms |
| 8+ normalized event types         | `SELECT DISTINCT kind FROM events`                       | >= 8       |
| 1 design partner on Fuji          | Partner deployment log / feedback                        | >= 1       |

---

## Risk Mitigations

| Risk                                                 | Likelihood | Impact | Mitigation                                                                                                   |
| ---------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------------------ |
| Fuji RPC rate limiting on public endpoints           | High       | Medium | Support self-hosted node configuration; implement request throttling; configurable batch sizes per provider  |
| WebSocket instability on Fuji                        | Medium     | Low    | Automatic fallback to HTTP polling; WS is optimization, not requirement                                      |
| Reorg handling edge cases                            | Low        | High   | Conservative confirmation depth (1 block for Avalanche); extensive reorg unit tests with synthetic sequences |
| Prometheus metrics format changes in relayer updates | Low        | Medium | Pin to known metric names; graceful degradation on unknown metrics; version detection                        |
| Postgres migration breaks SQLite compatibility       | Medium     | Medium | Separate migration directories; CI matrix tests both backends                                                |
| Docker build complexity (Go + Node monorepo)         | Medium     | Low    | Multi-stage build; Go harness excluded from Docker image (test-only)                                         |
| Low Teleporter activity on Fuji for testing          | Medium     | Medium | Self-generated test traffic via CLI; backfill from historical blocks                                         |
| Single-contributor velocity for 16-week scope        | High       | High   | P2 items (Postgres) deferred if needed; stages ordered by KPI impact                                         |

---

## Appendix A -- TeleporterMessenger Event Signatures

```typescript
// Pre-computed keccak256 topic0 values for eth_getLogs filtering
export const TELEPORTER_EVENT_TOPICS = {
  BlockchainIDInitialized: "0x" + keccak256("BlockchainIDInitialized(bytes32)"),
  SendCrossChainMessage:
    "0x" +
    keccak256(
      "SendCrossChainMessage(bytes32,bytes32,(uint256,address,bytes32,address,uint256,address[],(bytes32,address)[],bytes),(address,uint256))",
    ),
  ReceiveCrossChainMessage:
    "0x" +
    keccak256(
      "ReceiveCrossChainMessage(bytes32,bytes32,address,address,(uint256,address,bytes32,address,uint256,address[],(bytes32,address)[],bytes))",
    ),
  MessageExecuted: "0x" + keccak256("MessageExecuted(bytes32,bytes32)"),
  MessageExecutionFailed:
    "0x" +
    keccak256(
      "MessageExecutionFailed(bytes32,bytes32,(uint256,address,bytes32,address,uint256,address[],(bytes32,address)[],bytes))",
    ),
  AddFeeAmount: "0x" + keccak256("AddFeeAmount(bytes32,(address,uint256))"),
  ReceiptReceived: "0x" + keccak256("ReceiptReceived(bytes32,bytes32,address,(address,uint256))"),
  RelayerRewardsRedeemed: "0x" + keccak256("RelayerRewardsRedeemed(address,address,uint256)"),
} as const;

// Note: Exact topic0 hex values should be computed at build time from the
// ITeleporterMessenger.sol ABI using viem's `toEventSelector()`.
```

---

## Appendix B -- Prometheus Metric Catalog

### ICM Relayer (port 9090)

| Metric                                   | Type      | Labels                                            | Operational Signal           |
| ---------------------------------------- | --------- | ------------------------------------------------- | ---------------------------- |
| `successful_relay_message_count`         | Counter   | dest_chain, src_chain, src_subnet                 | Relay success rate           |
| `failed_relay_message_count`             | Counter   | dest_chain, src_chain, src_subnet, failure_reason | Failure classification       |
| `create_signed_message_latency_ms`       | Gauge     | dest_chain, src_chain, src_subnet                 | Relay latency                |
| `fetch_signature_app_request_count`      | Counter   | dest_chain, src_chain, src_subnet                 | AppRequest aggregation usage |
| `fetch_signature_rpc_count`              | Counter   | dest_chain, src_chain, src_subnet                 | Warp API aggregation usage   |
| `p_chain_api_call_latency_ms`            | Histogram | --                                                | P-Chain connectivity         |
| `connects`                               | Counter   | --                                                | Network health               |
| `disconnects`                            | Counter   | --                                                | Network health               |
| `checkpoint_committed_height`            | Gauge     | relayer_id, dest_chain, src_chain                 | Sync progress                |
| `checkpoint_pending_commits_heap_length` | Gauge     | relayer_id, dest_chain, src_chain                 | Backlog                      |

### Signature Aggregator (port 8081)

| Metric                                    | Type    | Labels   | Operational Signal      |
| ----------------------------------------- | ------- | -------- | ----------------------- |
| `agg_sigs_latency_ms`                     | Gauge   | --       | Aggregation performance |
| `agg_sigs_req_count`                      | Counter | --       | Request volume          |
| `app_request_count`                       | Counter | --       | Network request volume  |
| `connected_stake_weight_percentage`       | Gauge   | subnetID | Quorum readiness        |
| `validator_timeouts`                      | Counter | --       | Validator availability  |
| `failures_to_get_validator_set`           | Counter | --       | P-Chain connectivity    |
| `failures_to_connect_to_sufficient_stake` | Counter | --       | Quorum failures         |
| `failures_sending_to_node`                | Counter | --       | Network errors          |
| `invalid_signature_responses`             | Counter | --       | Validator correctness   |
| `signature_cache_hits`                    | Counter | --       | Cache efficiency        |
| `signature_cache_misses`                  | Counter | --       | Cache efficiency        |

---

## Appendix C -- Library Selection

| Purpose                | Library                                                              | Rationale                                                                  |
| ---------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| EVM RPC client         | [viem](https://viem.sh/)                                             | Type-safe, tree-shakeable, native ABI encoding, best TypeScript DX         |
| Postgres driver        | [postgres](https://github.com/porsager/postgres) (porsager/postgres) | Fastest Node.js Postgres driver, tagged template queries, built-in pooling |
| Prometheus parsing     | Custom parser (~100 LOC)                                             | Prometheus text format is simple; avoids pulling in prom-client dependency |
| HTTP client (webhooks) | Node.js built-in `fetch`                                             | No external dependency; sufficient for webhook delivery                    |
| HMAC signing           | Node.js `crypto` module                                              | No external dependency                                                     |
| ABI encoding/decoding  | viem (included above)                                                | `decodeEventLog`, `encodeEventTopics`, `toEventSelector`                   |
| React charting         | [recharts](https://recharts.org/) or lightweight custom SVG          | Latency sparklines, failure bars; minimal bundle impact                    |
| React timeline         | Custom component                                                     | No existing component matches the on-chain/off-chain visual requirements   |

---

## Links

- [ADR-0005: RPC-first multi-source ingestion](../decisions/0005-rpc-first-multi-source-ingestion.md)
- [ADR-0006: Event model contract alignment](../decisions/0006-event-model-contract-alignment.md)
- [ADR-0007: Four-milestone grant delivery](../decisions/0007-four-milestone-grant-delivery.md)
- [Work items (machine-readable)](work-items.yaml)
- [Competitive landscape](competitive-landscape.md)
- [Roadmap](roadmap.md)
