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
} from "@warplane/domain";
import type { NormalizedEvent, CorrelationResult, MessageState } from "./types.js";
import { STATE_TRANSITIONS } from "./types.js";

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
  getMessageState(messageId: string): MessageState | null;
  getTrace(messageId: string): MessageTrace | null;
  allTraces(): MessageTrace[];
}

export function createCorrelator(): Correlator {
  const traces = new Map<string, TraceState>();

  function processEvent(event: NormalizedEvent): CorrelationResult {
    const existing = traces.get(event.messageId);

    if (!existing) {
      return createNewTrace(event);
    }

    return updateExistingTrace(existing, event);
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
    enrichTrace(trace, event);

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
    enrichTrace(ts.trace, event);

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

  return { processEvent, getMessageState, getTrace, allTraces };
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
    details: JSON.stringify(event.details, (_k, v) => (typeof v === "bigint" ? v.toString() : v)),
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

function enrichTrace(trace: MessageTrace, event: NormalizedEvent): void {
  const d = event.details;

  switch (event.kind) {
    case "message_sent":
      trace.sourceTxHash = event.txHash;
      trace.source = {
        ...trace.source,
        blockchainId: event.chain,
        name: event.chain,
      };
      if (d.destinationBlockchainID && typeof d.destinationBlockchainID === "string") {
        trace.destination = {
          ...trace.destination,
          blockchainId: d.destinationBlockchainID,
          name: d.destinationBlockchainID,
        };
      }
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
      if (d.sourceBlockchainID && typeof d.sourceBlockchainID === "string") {
        trace.source = {
          ...trace.source,
          blockchainId: d.sourceBlockchainID,
          name: d.sourceBlockchainID,
        };
      }
      trace.timestamps.blockRecv = event.blockNumber;
      if (event.timestamp) trace.timestamps.receiveTime = event.timestamp;
      if (typeof d.deliverer === "string") {
        trace.relayer = { address: d.deliverer, txHash: event.txHash };
      }
      break;

    case "fee_added": {
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
      break;

    case "replay_blocked":
      trace.replayProtectionObserved = true;
      break;
  }
}
