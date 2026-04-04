/**
 * Correlator FSM — assembles NormalizedEvents into MessageTrace records.
 *
 * Maintains in-memory state per messageId, applies the state transition table,
 * and builds/updates MessageTrace objects. Pure state machine — no I/O.
 *
 * Special handling:
 * - MessageExecuted (retry_succeeded): only transitions from "failed" state
 * - Partial traces: delivery_confirmed before message_sent creates trace in
 *   "delivered" state, completed by later message_sent event
 */

import type {
  MessageEvent,
  MessageEventKind,
  MessageTrace,
  ExecutionStatus,
  ChainMeta,
} from "@warplane/domain";
import type { NormalizedEvent, CorrelationResult, MessageState, ChainRegistry } from "./types.js";
import { STATE_TRANSITIONS } from "./types.js";
import {
  createChainResolver,
  cloneChainMeta,
  isRawBlockchainId,
  type ChainResolver,
} from "./chain-resolver.js";

// ---------------------------------------------------------------------------
// Internal trace state
// ---------------------------------------------------------------------------

interface TraceState {
  state: MessageState;
  trace: MessageTrace;
  partial: boolean;
}

// ---------------------------------------------------------------------------
// Placeholder chain meta for partial traces
// ---------------------------------------------------------------------------

const UNKNOWN_CHAIN = {
  name: "unknown",
  blockchainId: "",
  subnetId: "",
  evmChainId: 0,
};

const PLACEHOLDER_TIMESTAMPS = {
  sendTime: "1970-01-01T00:00:00.000Z",
  receiveTime: "1970-01-01T00:00:00.000Z",
  blockSend: 0,
};

// ---------------------------------------------------------------------------
// Correlator
// ---------------------------------------------------------------------------

export interface Correlator {
  processEvent(event: NormalizedEvent): CorrelationResult;
  seedTrace(trace: MessageTrace): void;
  getMessageState(messageId: string): MessageState | null;
  getTrace(messageId: string): MessageTrace | null;
  allTraces(): MessageTrace[];
}

export function createCorrelator(chainRegistry?: ChainRegistry): Correlator {
  const traces = new Map<string, TraceState>();
  const chainResolver = createChainResolver(chainRegistry);

  function processEvent(event: NormalizedEvent): CorrelationResult {
    const existing = traces.get(event.messageId);

    if (!existing) {
      return createNewTrace(event);
    }

    return updateExistingTrace(existing, event);
  }

  function seedTrace(trace: MessageTrace): void {
    if (traces.has(trace.messageId)) return;

    traces.set(trace.messageId, {
      state: traceToState(trace),
      trace: cloneTrace(trace),
      partial: isPartialTrace(trace),
    });
  }

  function createNewTrace(event: NormalizedEvent): CorrelationResult {
    const initialState = resolveInitialState(event.kind);

    const trace: MessageTrace = {
      schemaVersion: "1.0.0",
      messageId: event.messageId,
      scenario: "on-chain",
      execution: stateToExecution(initialState),
      source: UNKNOWN_CHAIN,
      destination: UNKNOWN_CHAIN,
      sender: "",
      recipient: "",
      sourceTxHash: "",
      timestamps: { ...PLACEHOLDER_TIMESTAMPS },
      events: [toMessageEvent(event)],
    };

    // Enrich from event details
    enrichTrace(trace, event, chainResolver);

    const partial = event.kind !== "message_sent";
    traces.set(event.messageId, { state: initialState, trace, partial });

    return {
      messageId: event.messageId,
      previousState: null,
      newState: initialState,
      trace,
      isNew: true,
      isStateChange: true,
    };
  }

  function updateExistingTrace(ts: TraceState, event: NormalizedEvent): CorrelationResult {
    const previousState = ts.state;

    if (isDuplicateEvent(ts.trace, event)) {
      return {
        messageId: event.messageId,
        previousState,
        newState: previousState,
        trace: ts.trace,
        isNew: false,
        isStateChange: false,
      };
    }

    // Special: retry_succeeded only applies from failed or retrying state
    if (event.kind === "retry_succeeded" && ts.state !== "failed" && ts.state !== "retrying") {
      // Skip — initial execution is covered by delivery_confirmed
      ts.trace.events.push(toMessageEvent(event));
      return {
        messageId: event.messageId,
        previousState,
        newState: previousState,
        trace: ts.trace,
        isNew: false,
        isStateChange: false,
      };
    }

    const nextState = STATE_TRANSITIONS[ts.state]?.[event.kind];
    const isStateChange = nextState !== undefined;

    if (isStateChange) {
      ts.state = nextState;
      ts.trace.execution = stateToExecution(nextState);
    }

    ts.trace.events.push(toMessageEvent(event));
    enrichTrace(ts.trace, event, chainResolver);

    // If this is a message_sent arriving after a partial trace, complete it
    if (event.kind === "message_sent" && ts.partial) {
      ts.partial = false;
    }

    return {
      messageId: event.messageId,
      previousState,
      newState: ts.state,
      trace: ts.trace,
      isNew: false,
      isStateChange,
    };
  }

  function getMessageState(messageId: string): MessageState | null {
    return traces.get(messageId)?.state ?? null;
  }

  function getTrace(messageId: string): MessageTrace | null {
    return traces.get(messageId)?.trace ?? null;
  }

  function allTraces(): MessageTrace[] {
    return Array.from(traces.values()).map((ts) => ts.trace);
  }

  return { processEvent, seedTrace, getMessageState, getTrace, allTraces };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveInitialState(kind: MessageEventKind): MessageState {
  switch (kind) {
    case "message_sent":
      return "pending";
    case "delivery_confirmed":
      return "delivered";
    case "execution_failed":
      return "failed";
    case "fee_added":
      return "pending";
    case "retry_succeeded":
      return "pending";
    case "receipts_sent":
      return "receipted";
    case "replay_blocked":
      return "replay_blocked";
    default:
      return "pending";
  }
}

function stateToExecution(state: MessageState): ExecutionStatus {
  switch (state) {
    case "delivered":
    case "receipted":
      return "success";
    case "retry_success":
      return "retry_success";
    case "replay_blocked":
      return "replay_blocked";
    case "failed":
      return "failed";
    default:
      return "pending";
  }
}

function toMessageEvent(event: NormalizedEvent): MessageEvent {
  const base = {
    timestamp: event.timestamp || "1970-01-01T00:00:00.000Z",
    details: stringifyDetails(event.details),
  };

  const onChain = {
    blockNumber: event.blockNumber,
    txHash: event.txHash,
    chain: event.chain,
  };

  switch (event.kind) {
    case "warp_message_extracted":
      return { ...base, kind: "warp_message_extracted", chain: event.chain };
    case "signatures_aggregated":
      return { ...base, kind: "signatures_aggregated" };
    default:
      return { ...base, ...onChain, kind: event.kind } as MessageEvent;
  }
}

function cloneTrace(trace: MessageTrace): MessageTrace {
  return {
    ...trace,
    source: { ...trace.source },
    destination: { ...trace.destination },
    timestamps: { ...trace.timestamps },
    events: trace.events.map((event) => ({ ...event })),
    relayer: trace.relayer ? { ...trace.relayer } : undefined,
    fee: trace.fee ? { ...trace.fee } : undefined,
    retry: trace.retry ? { ...trace.retry } : undefined,
    artifacts: trace.artifacts?.map((artifact) => ({ ...artifact })),
    rawRefs: trace.rawRefs ? [...trace.rawRefs] : undefined,
  };
}

function isPartialTrace(trace: MessageTrace): boolean {
  return (
    trace.timestamps.blockSend === 0 || !trace.events.some((event) => event.kind === "message_sent")
  );
}

function traceToState(trace: MessageTrace): MessageState {
  if (trace.receiptDelivered) return "receipted";

  switch (trace.execution) {
    case "success":
      return "delivered";
    case "retry_success":
      return "retry_success";
    case "replay_blocked":
      return "replay_blocked";
    case "failed":
      return trace.retry ? "retrying" : "failed";
    default:
      return "pending";
  }
}

function isDuplicateEvent(trace: MessageTrace, event: NormalizedEvent): boolean {
  return trace.events.some((existing) => {
    if (existing.kind !== event.kind) return false;

    if ("blockNumber" in existing && "txHash" in existing && "chain" in existing) {
      return (
        existing.blockNumber === event.blockNumber &&
        existing.txHash === event.txHash &&
        existing.chain === event.chain
      );
    }

    return (
      existing.timestamp === (event.timestamp || PLACEHOLDER_TIMESTAMPS.sendTime) &&
      existing.details === stringifyDetails(event.details)
    );
  });
}

function stringifyDetails(details: Record<string, unknown>): string {
  return JSON.stringify(details, (_k, value) =>
    typeof value === "bigint" ? value.toString() : value,
  );
}

function enrichTrace(
  trace: MessageTrace,
  event: NormalizedEvent,
  chainResolver: ChainResolver,
): void {
  const d = event.details;

  switch (event.kind) {
    case "message_sent":
      trace.sourceTxHash = event.txHash;
      trace.source = observedChainMeta(chainResolver, event.chain);
      applyReferencedChain(trace, "destination", d.destinationBlockchainID, chainResolver);
      if (typeof d.originSenderAddress === "string") trace.sender = d.originSenderAddress;
      if (typeof d.destinationAddress === "string") trace.recipient = d.destinationAddress;
      trace.timestamps.blockSend = event.blockNumber;
      if (event.timestamp) trace.timestamps.sendTime = event.timestamp;
      if (typeof d.requiredGasLimit === "string") {
        trace.requiredGasLimit = parseInt(d.requiredGasLimit, 10) || undefined;
      }
      break;

    case "delivery_confirmed":
      trace.destinationTxHash = event.txHash;
      trace.destination = observedChainMeta(chainResolver, event.chain);
      applyReferencedChain(trace, "source", d.sourceBlockchainID, chainResolver);
      if (typeof d.originSenderAddress === "string" && !trace.sender)
        trace.sender = d.originSenderAddress;
      if (typeof d.destinationAddress === "string" && !trace.recipient) {
        trace.recipient = d.destinationAddress;
      }
      trace.timestamps.blockRecv = event.blockNumber;
      if (event.timestamp) trace.timestamps.receiveTime = event.timestamp;
      if (typeof d.deliverer === "string") {
        trace.relayer = { address: d.deliverer, txHash: event.txHash };
      }
      if (typeof d.requiredGasLimit === "string" && trace.requiredGasLimit === undefined) {
        trace.requiredGasLimit = parseInt(d.requiredGasLimit, 10) || undefined;
      }
      break;

    case "execution_failed":
      trace.destinationTxHash = event.txHash;
      trace.destination = observedChainMeta(chainResolver, event.chain);
      applyReferencedChain(trace, "source", d.sourceBlockchainID, chainResolver);
      applyMessageDetails(trace, d, chainResolver);
      if (trace.timestamps.blockRecv === undefined) {
        trace.timestamps.blockRecv = event.blockNumber;
      }
      if (event.timestamp && isPlaceholderTimestamp(trace.timestamps.receiveTime)) {
        trace.timestamps.receiveTime = event.timestamp;
      }
      break;

    case "retry_succeeded":
      trace.destinationTxHash = event.txHash;
      trace.destination = observedChainMeta(chainResolver, event.chain);
      applyReferencedChain(trace, "source", d.sourceBlockchainID, chainResolver);
      if (trace.timestamps.blockRecv === undefined) {
        trace.timestamps.blockRecv = event.blockNumber;
      }
      if (event.timestamp && isPlaceholderTimestamp(trace.timestamps.receiveTime)) {
        trace.timestamps.receiveTime = event.timestamp;
      }
      break;

    case "fee_added": {
      trace.source = observedChainMeta(chainResolver, event.chain);
      const feeInfo = d.updatedFeeInfo as Record<string, unknown> | undefined;
      if (feeInfo) {
        trace.fee = {
          feeTokenAddress: String(feeInfo.feeTokenAddress ?? ""),
          initialAmount: trace.fee?.initialAmount ?? "0",
          addedAmount: String(feeInfo.amount ?? "0"),
          totalAmount: String(feeInfo.amount ?? "0"),
        };
      }
      break;
    }

    case "receipts_sent":
      trace.receiptDelivered = true;
      trace.source = observedChainMeta(chainResolver, event.chain);
      applyReferencedChain(trace, "destination", d.destinationBlockchainID, chainResolver);
      break;

    case "replay_blocked":
      trace.destination = observedChainMeta(chainResolver, event.chain);
      trace.replayProtectionObserved = true;
      break;
  }
}

function observedChainMeta(chainResolver: ChainResolver, blockchainId: string): ChainMeta {
  return cloneChainMeta(chainResolver.getChainMeta(blockchainId) ?? unmappedChain(blockchainId));
}

function applyReferencedChain(
  trace: MessageTrace,
  side: "source" | "destination",
  blockchainId: unknown,
  chainResolver: ChainResolver,
): void {
  if (typeof blockchainId !== "string" || !blockchainId) return;

  const next = referencedChainMeta(chainResolver, blockchainId);
  const current = side === "source" ? trace.source : trace.destination;
  if (!shouldReplaceChain(current, next)) return;

  if (side === "source") {
    trace.source = next;
  } else {
    trace.destination = next;
  }
}

function referencedChainMeta(chainResolver: ChainResolver, blockchainId: string): ChainMeta {
  const resolved = chainResolver.getChainMeta(blockchainId);
  if (resolved) return cloneChainMeta(resolved);

  return unmappedChain(chainResolver.canonicalizeBlockchainId(blockchainId));
}

function applyMessageDetails(
  trace: MessageTrace,
  details: Record<string, unknown>,
  chainResolver: ChainResolver,
): void {
  if (typeof details.originSenderAddress === "string" && !trace.sender) {
    trace.sender = details.originSenderAddress;
  }
  if (typeof details.destinationAddress === "string" && !trace.recipient) {
    trace.recipient = details.destinationAddress;
  }
  if (typeof details.requiredGasLimit === "string" && trace.requiredGasLimit === undefined) {
    trace.requiredGasLimit = parseInt(details.requiredGasLimit, 10) || undefined;
  }
  applyReferencedChain(trace, "destination", details.destinationBlockchainID, chainResolver);
}

function shouldReplaceChain(current: ChainMeta, next: ChainMeta): boolean {
  if (!current.blockchainId) return true;
  if (current.blockchainId === next.blockchainId) return true;
  if (isRawBlockchainId(current.blockchainId) && !isRawBlockchainId(next.blockchainId)) {
    return true;
  }
  return false;
}

function unmappedChain(blockchainId: string): ChainMeta {
  if (!blockchainId) {
    return { ...UNKNOWN_CHAIN };
  }

  return {
    ...UNKNOWN_CHAIN,
    name: blockchainId,
    blockchainId,
  };
}

function isPlaceholderTimestamp(timestamp: string): boolean {
  return timestamp === PLACEHOLDER_TIMESTAMPS.receiveTime;
}
