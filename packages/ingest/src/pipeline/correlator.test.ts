import { describe, it, expect } from "vitest";
import { createCorrelator } from "./correlator.js";
import type { NormalizedEvent } from "./types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MSG_ID = "0xmsg1";
const CHAIN_A = "chain-a";
const CHAIN_B = "chain-b";

function makeNormalized(
  kind: NormalizedEvent["kind"],
  overrides?: Partial<NormalizedEvent>,
): NormalizedEvent {
  return {
    kind,
    messageId: MSG_ID,
    timestamp: "",
    blockNumber: 100,
    txHash: "0xtx100",
    chain: CHAIN_A,
    source: "on-chain",
    details: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Correlator", () => {
  it("message_sent creates trace in pending state", () => {
    const c = createCorrelator();
    const result = c.processEvent(makeNormalized("message_sent"));

    expect(result.isNew).toBe(true);
    expect(result.newState).toBe("pending");
    expect(result.trace.messageId).toBe(MSG_ID);
    expect(result.trace.execution).toBe("pending");
  });

  it("pending → delivery_confirmed → delivered", () => {
    const c = createCorrelator();
    c.processEvent(makeNormalized("message_sent"));
    const result = c.processEvent(
      makeNormalized("delivery_confirmed", { chain: CHAIN_B, txHash: "0xtxDeliver" }),
    );

    expect(result.isStateChange).toBe(true);
    expect(result.previousState).toBe("pending");
    expect(result.newState).toBe("delivered");
    expect(result.trace.execution).toBe("success");
  });

  it("delivered → receipts_sent → receipted (terminal)", () => {
    const c = createCorrelator();
    c.processEvent(makeNormalized("message_sent"));
    c.processEvent(makeNormalized("delivery_confirmed"));
    const result = c.processEvent(makeNormalized("receipts_sent"));

    expect(result.newState).toBe("receipted");
    expect(result.trace.receiptDelivered).toBe(true);
  });

  it("pending → execution_failed → failed", () => {
    const c = createCorrelator();
    c.processEvent(makeNormalized("message_sent"));
    const result = c.processEvent(makeNormalized("execution_failed"));

    expect(result.newState).toBe("failed");
    expect(result.trace.execution).toBe("failed");
  });

  it("failed → retry_requested → retrying", () => {
    const c = createCorrelator();
    c.processEvent(makeNormalized("message_sent"));
    c.processEvent(makeNormalized("execution_failed"));
    const result = c.processEvent(makeNormalized("retry_requested"));

    expect(result.previousState).toBe("failed");
    expect(result.newState).toBe("retrying");
  });

  it("retrying → retry_succeeded → retry_success", () => {
    const c = createCorrelator();
    c.processEvent(makeNormalized("message_sent"));
    c.processEvent(makeNormalized("execution_failed"));
    c.processEvent(makeNormalized("retry_requested"));
    const result = c.processEvent(makeNormalized("retry_succeeded"));

    expect(result.newState).toBe("retry_success");
    expect(result.trace.execution).toBe("retry_success");
  });

  it("retry_success → receipts_sent → receipted", () => {
    const c = createCorrelator();
    c.processEvent(makeNormalized("message_sent"));
    c.processEvent(makeNormalized("execution_failed"));
    c.processEvent(makeNormalized("retry_requested"));
    c.processEvent(makeNormalized("retry_succeeded"));
    const result = c.processEvent(makeNormalized("receipts_sent"));

    expect(result.newState).toBe("receipted");
  });

  it("pending → replay_blocked (terminal)", () => {
    const c = createCorrelator();
    c.processEvent(makeNormalized("message_sent"));
    const result = c.processEvent(makeNormalized("replay_blocked"));

    expect(result.newState).toBe("replay_blocked");
    expect(result.trace.execution).toBe("replay_blocked");
    expect(result.trace.replayProtectionObserved).toBe(true);
  });

  it("invalid transition: state unchanged, no error", () => {
    const c = createCorrelator();
    c.processEvent(makeNormalized("message_sent"));
    // receipts_sent is not valid from "pending"
    const result = c.processEvent(makeNormalized("receipts_sent"));

    expect(result.isStateChange).toBe(false);
    expect(result.newState).toBe("pending");
    // Event is still recorded
    expect(result.trace.events).toHaveLength(2);
  });

  it("MessageExecuted (retry_succeeded) with prior failed → retry_succeeded", () => {
    const c = createCorrelator();
    c.processEvent(makeNormalized("message_sent"));
    c.processEvent(makeNormalized("execution_failed"));
    // retry_requested transitions to retrying, but let's test via failed → retry_succeeded
    // Actually the FSM goes failed → retry_requested → retrying → retry_succeeded
    c.processEvent(makeNormalized("retry_requested"));
    const result = c.processEvent(makeNormalized("retry_succeeded"));

    expect(result.isStateChange).toBe(true);
    expect(result.newState).toBe("retry_success");
  });

  it("MessageExecuted (retry_succeeded) without prior failed → skipped", () => {
    const c = createCorrelator();
    c.processEvent(makeNormalized("message_sent"));
    // retry_succeeded from pending state — should be skipped
    const result = c.processEvent(makeNormalized("retry_succeeded"));

    expect(result.isStateChange).toBe(false);
    expect(result.newState).toBe("pending");
  });

  it("partial trace: delivery_confirmed before message_sent", () => {
    const c = createCorrelator();
    const result = c.processEvent(
      makeNormalized("delivery_confirmed", {
        chain: CHAIN_B,
        details: { sourceBlockchainID: CHAIN_A, deliverer: "0xRelayer" },
      }),
    );

    expect(result.isNew).toBe(true);
    expect(result.newState).toBe("delivered");
    expect(result.trace.execution).toBe("success");
  });

  it("partial trace completed by later message_sent", () => {
    const c = createCorrelator();
    // delivery arrives first (backfill order)
    c.processEvent(
      makeNormalized("delivery_confirmed", {
        chain: CHAIN_B,
        details: { sourceBlockchainID: CHAIN_A, deliverer: "0xRelayer" },
      }),
    );
    // Then send event arrives
    const result = c.processEvent(
      makeNormalized("message_sent", {
        chain: CHAIN_A,
        txHash: "0xSendTx",
        details: {
          destinationBlockchainID: CHAIN_B,
          originSenderAddress: "0xSender",
          destinationAddress: "0xRecipient",
        },
      }),
    );

    expect(result.isNew).toBe(false);
    expect(result.trace.sender).toBe("0xSender");
    expect(result.trace.recipient).toBe("0xRecipient");
    expect(result.trace.sourceTxHash).toBe("0xSendTx");
  });

  it("fee_added updates fee info on existing trace", () => {
    const c = createCorrelator();
    c.processEvent(makeNormalized("message_sent"));
    const result = c.processEvent(
      makeNormalized("fee_added", {
        details: { updatedFeeInfo: { feeTokenAddress: "0xToken", amount: 500n } },
      }),
    );

    expect(result.trace.fee).toBeDefined();
    expect(result.trace.fee!.feeTokenAddress).toBe("0xToken");
  });

  it("getMessageState returns null for unknown messageId", () => {
    const c = createCorrelator();
    expect(c.getMessageState("nonexistent")).toBeNull();
  });
});
