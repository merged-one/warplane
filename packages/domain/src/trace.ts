/**
 * Canonical trace model for cross-chain Teleporter messages.
 *
 * A MessageTrace captures the full lifecycle of a single message:
 * source/destination chains, sender/recipient, events, execution outcome,
 * relayer info, fee data, retry mechanics, and artifact references.
 *
 * @module trace
 * @version 1.0.0
 */

import { z } from "zod";
import { MessageEvent } from "./events.js";

// ---------------------------------------------------------------------------
// Chain metadata (as emitted by the harness / ingestion)
// ---------------------------------------------------------------------------

export const ChainMeta = z.object({
  name: z.string(),
  blockchainId: z.string(),
  subnetId: z.string(),
  evmChainId: z.number().int(),
});
export type ChainMeta = z.infer<typeof ChainMeta>;

// ---------------------------------------------------------------------------
// Timestamps block
// ---------------------------------------------------------------------------

export const TraceTimestamps = z.object({
  sendTime: z.string().datetime({ offset: true }),
  receiveTime: z.string().datetime({ offset: true }),
  blockSend: z.number().int().nonnegative(),
  blockRecv: z.number().int().nonnegative().optional(),
});
export type TraceTimestamps = z.infer<typeof TraceTimestamps>;

// ---------------------------------------------------------------------------
// Relayer info
// ---------------------------------------------------------------------------

export const RelayerInfo = z.object({
  address: z.string(),
  txHash: z.string(),
});
export type RelayerInfo = z.infer<typeof RelayerInfo>;

// ---------------------------------------------------------------------------
// Fee info
// ---------------------------------------------------------------------------

export const FeeInfo = z.object({
  feeTokenAddress: z.string(),
  initialAmount: z.string(),
  addedAmount: z.string(),
  totalAmount: z.string(),
});
export type FeeInfo = z.infer<typeof FeeInfo>;

// ---------------------------------------------------------------------------
// Retry info
// ---------------------------------------------------------------------------

export const RetryInfo = z.object({
  originalGasLimit: z.number().int().nonnegative(),
  retryGasLimit: z.number().int().nonnegative(),
  retryTxHash: z.string(),
});
export type RetryInfo = z.infer<typeof RetryInfo>;

// ---------------------------------------------------------------------------
// Execution status
// ---------------------------------------------------------------------------

export const ExecutionStatus = z.enum([
  "success",
  "retry_success",
  "replay_blocked",
  "failed",
  "pending",
]);
export type ExecutionStatus = z.infer<typeof ExecutionStatus>;

// ---------------------------------------------------------------------------
// Artifact reference
// ---------------------------------------------------------------------------

export const ArtifactReference = z.object({
  type: z.enum(["trace", "scenario_run", "network_manifest", "log", "other"]),
  path: z.string(),
  description: z.string().optional(),
});
export type ArtifactReference = z.infer<typeof ArtifactReference>;

// ---------------------------------------------------------------------------
// MessageTrace -- the canonical trace record
// ---------------------------------------------------------------------------

export const MessageTrace = z.object({
  /** Schema version for forwards-compatible evolution. */
  schemaVersion: z.string().default("1.0.0"),

  /** SHA-256 deterministic message identifier. */
  messageId: z.string(),

  /** Scenario that produced this trace. */
  scenario: z.string(),

  /** Execution status of the message lifecycle. */
  execution: ExecutionStatus,

  // -- Chain endpoints ---
  source: ChainMeta,
  destination: ChainMeta,

  // -- Participants ---
  sender: z.string(),
  recipient: z.string(),

  // -- Transaction hashes ---
  sourceTxHash: z.string(),
  destinationTxHash: z.string().optional(),
  relayTxHash: z.string().optional(),

  // -- Timing ---
  timestamps: TraceTimestamps,

  // -- Ordered lifecycle events ---
  events: z.array(MessageEvent),

  // -- Relayer ---
  relayer: RelayerInfo.optional(),

  // -- Fee management ---
  fee: FeeInfo.optional(),

  // -- Retry mechanics ---
  retry: RetryInfo.optional(),

  // -- Gas / execution details ---
  requiredGasLimit: z.number().int().nonnegative().optional(),
  feeTokenAddress: z.string().optional(),
  feeAmount: z.string().optional(),
  relayerAddress: z.string().optional(),
  receiptDelivered: z.boolean().optional(),
  retryCount: z.number().int().nonnegative().optional(),
  replayProtectionObserved: z.boolean().optional(),

  // -- Artifact references ---
  artifacts: z.array(ArtifactReference).optional(),

  // -- Raw tx hash references for audit ---
  rawRefs: z.array(z.string()).optional(),
});
export type MessageTrace = z.infer<typeof MessageTrace>;

// ---------------------------------------------------------------------------
// Trace index (the top-level index.json)
// ---------------------------------------------------------------------------

export const TraceIndexEntry = z.object({
  messageId: z.string(),
  scenario: z.string(),
  file: z.string(),
  execution: ExecutionStatus,
});
export type TraceIndexEntry = z.infer<typeof TraceIndexEntry>;

export const TraceIndex = z.object({
  generatedAt: z.string().datetime({ offset: true }),
  traces: z.array(TraceIndexEntry),
});
export type TraceIndex = z.infer<typeof TraceIndex>;
