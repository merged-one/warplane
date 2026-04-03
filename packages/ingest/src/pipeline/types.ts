/**
 * Pipeline types — shared interfaces for normalization, correlation, and coordination.
 */

import type { MessageEventKind } from "@warplane/domain";
import type { MessageTrace, ChainMeta } from "@warplane/domain";

// ---------------------------------------------------------------------------
// Message lifecycle FSM states
// ---------------------------------------------------------------------------

export type MessageState =
  | "pending"
  | "relaying"
  | "delivered"
  | "failed"
  | "retrying"
  | "retry_success"
  | "replay_blocked"
  | "receipted";

// ---------------------------------------------------------------------------
// Normalized event (output of normalizer, input to correlator)
// ---------------------------------------------------------------------------

export interface NormalizedEvent {
  kind: MessageEventKind;
  messageId: string;
  timestamp: string;
  blockNumber: number;
  txHash: string;
  chain: string;
  source: "on-chain" | "off-chain";
  details: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Correlation result (output of correlator)
// ---------------------------------------------------------------------------

export interface CorrelationResult {
  messageId: string;
  previousState: MessageState | null;
  newState: MessageState;
  trace: MessageTrace;
  isNew: boolean;
  isStateChange: boolean;
}

// ---------------------------------------------------------------------------
// Pipeline stats
// ---------------------------------------------------------------------------

export interface PipelineStats {
  eventsReceived: number;
  eventsNormalized: number;
  eventsDropped: number;
  tracesCreated: number;
  tracesUpdated: number;
}

// ---------------------------------------------------------------------------
// Chain registry
// ---------------------------------------------------------------------------

export type ChainRegistry = Map<string, ChainMeta>;

// ---------------------------------------------------------------------------
// State transition table
// ---------------------------------------------------------------------------

export const STATE_TRANSITIONS: Record<
  MessageState,
  Partial<Record<MessageEventKind, MessageState>>
> = {
  pending: {
    delivery_confirmed: "delivered",
    execution_failed: "failed",
    warp_message_extracted: "relaying",
    replay_blocked: "replay_blocked",
  },
  relaying: {
    delivery_confirmed: "delivered",
    execution_failed: "failed",
    signatures_aggregated: "relaying",
    relay_submitted: "relaying",
  },
  delivered: {
    receipts_sent: "receipted",
    fee_added: "delivered",
  },
  failed: {
    retry_requested: "retrying",
    retry_succeeded: "retry_success",
    fee_added: "failed",
  },
  retrying: {
    retry_succeeded: "retry_success",
    execution_failed: "failed",
  },
  retry_success: {
    receipts_sent: "receipted",
  },
  replay_blocked: {},
  receipted: {},
};
