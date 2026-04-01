/**
 * Canonical event model for Teleporter cross-chain message lifecycle.
 *
 * Each event kind carries a strongly-typed payload discriminated by `kind`.
 * The union covers every observable step from send through delivery, plus
 * fee management, retry mechanics, receipt handling, and replay protection.
 *
 * @module events
 * @version 1.0.0
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Event kinds -- the discriminant values
// ---------------------------------------------------------------------------

export const MessageEventKind = z.enum([
  "message_sent",
  "warp_message_extracted",
  "signatures_aggregated",
  "relay_submitted",
  "delivery_confirmed",
  "execution_failed",
  "retry_requested",
  "retry_succeeded",
  "fee_added",
  "receipts_sent",
  "replay_blocked",
]);
export type MessageEventKind = z.infer<typeof MessageEventKind>;

// ---------------------------------------------------------------------------
// Shared base fields (every event has these)
// ---------------------------------------------------------------------------

const EventBase = z.object({
  timestamp: z.string().datetime({ offset: true }),
  details: z.string().optional(),
});

// ---------------------------------------------------------------------------
// On-chain event fields (present when the event maps to a tx)
// ---------------------------------------------------------------------------

const OnChainFields = z.object({
  blockNumber: z.number().int().nonnegative(),
  txHash: z.string(),
  chain: z.string(),
});

// ---------------------------------------------------------------------------
// Per-kind event schemas
// ---------------------------------------------------------------------------

export const MessageSentEvent = EventBase.merge(OnChainFields).extend({
  kind: z.literal("message_sent"),
});
export type MessageSentEvent = z.infer<typeof MessageSentEvent>;

export const WarpMessageExtractedEvent = EventBase.extend({
  kind: z.literal("warp_message_extracted"),
  chain: z.string(),
});
export type WarpMessageExtractedEvent = z.infer<
  typeof WarpMessageExtractedEvent
>;

export const SignaturesAggregatedEvent = EventBase.extend({
  kind: z.literal("signatures_aggregated"),
});
export type SignaturesAggregatedEvent = z.infer<
  typeof SignaturesAggregatedEvent
>;

export const RelaySubmittedEvent = EventBase.merge(OnChainFields).extend({
  kind: z.literal("relay_submitted"),
});
export type RelaySubmittedEvent = z.infer<typeof RelaySubmittedEvent>;

export const DeliveryConfirmedEvent = EventBase.merge(OnChainFields).extend({
  kind: z.literal("delivery_confirmed"),
});
export type DeliveryConfirmedEvent = z.infer<typeof DeliveryConfirmedEvent>;

export const ExecutionFailedEvent = EventBase.merge(OnChainFields).extend({
  kind: z.literal("execution_failed"),
});
export type ExecutionFailedEvent = z.infer<typeof ExecutionFailedEvent>;

export const RetryRequestedEvent = EventBase.merge(OnChainFields).extend({
  kind: z.literal("retry_requested"),
});
export type RetryRequestedEvent = z.infer<typeof RetryRequestedEvent>;

export const RetrySucceededEvent = EventBase.merge(OnChainFields).extend({
  kind: z.literal("retry_succeeded"),
});
export type RetrySucceededEvent = z.infer<typeof RetrySucceededEvent>;

export const FeeAddedEvent = EventBase.merge(OnChainFields).extend({
  kind: z.literal("fee_added"),
});
export type FeeAddedEvent = z.infer<typeof FeeAddedEvent>;

export const ReceiptsSentEvent = EventBase.merge(OnChainFields).extend({
  kind: z.literal("receipts_sent"),
});
export type ReceiptsSentEvent = z.infer<typeof ReceiptsSentEvent>;

export const ReplayBlockedEvent = EventBase.merge(OnChainFields).extend({
  kind: z.literal("replay_blocked"),
});
export type ReplayBlockedEvent = z.infer<typeof ReplayBlockedEvent>;

// ---------------------------------------------------------------------------
// Discriminated union
// ---------------------------------------------------------------------------

export const MessageEvent = z.discriminatedUnion("kind", [
  MessageSentEvent,
  WarpMessageExtractedEvent,
  SignaturesAggregatedEvent,
  RelaySubmittedEvent,
  DeliveryConfirmedEvent,
  ExecutionFailedEvent,
  RetryRequestedEvent,
  RetrySucceededEvent,
  FeeAddedEvent,
  ReceiptsSentEvent,
  ReplayBlockedEvent,
]);
export type MessageEvent = z.infer<typeof MessageEvent>;
