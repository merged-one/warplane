import { describe, it, expect } from "vitest";
import { createCorrelator } from "./correlator.js";
import type { NormalizedEvent } from "./types.js";
import type { ChainRegistry } from "./types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MSG_ID = "0xmsg1";
const CHAIN_A = "chain-a";
const CHAIN_B = "chain-b";
const CANONICAL_SOURCE = "2LFmzhHDKxkreihEtPanVmofuFn63bsh8twnRXEbDhBtCJxURB";
const RAW_SOURCE = "0xaf6a974f467006d94388f438014162dd12ec2d1475c48faf09ffe7222d59e478";
const CANONICAL_DEST = "2q9e4r6Mu3U68nU1fYjgbR6JvwrRx36CohpAX5UQxse55x1Q5";
const RAW_DEST = "0x0427d4b22a2a78bcddd456742caf91b56badbff985ee19aef14573e7343fd652";

const CHAIN_REGISTRY: ChainRegistry = new Map([
  [
    CANONICAL_SOURCE,
    {
      name: "Henesys",
      blockchainId: CANONICAL_SOURCE,
      subnetId: "",
      evmChainId: 68414,
    },
  ],
  [
    CANONICAL_DEST,
    {
      name: "Mainnet C-Chain",
      blockchainId: CANONICAL_DEST,
      subnetId: "",
      evmChainId: 43114,
    },
  ],
]);

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
    const c = createCorrelator(CHAIN_REGISTRY);
    const result = c.processEvent(
      makeNormalized("delivery_confirmed", {
        chain: CANONICAL_DEST,
        details: { sourceBlockchainID: RAW_SOURCE, deliverer: "0xRelayer" },
      }),
    );

    expect(result.isNew).toBe(true);
    expect(result.newState).toBe("delivered");
    expect(result.trace.execution).toBe("success");
    expect(result.trace.source.blockchainId).toBe(CANONICAL_SOURCE);
    expect(result.trace.source.name).toBe("Henesys");
    expect(result.trace.destination.blockchainId).toBe(CANONICAL_DEST);
  });

  it("partial trace completed by later message_sent", () => {
    const c = createCorrelator(CHAIN_REGISTRY);
    // delivery arrives first (backfill order)
    c.processEvent(
      makeNormalized("delivery_confirmed", {
        chain: CANONICAL_DEST,
        details: { sourceBlockchainID: RAW_SOURCE, deliverer: "0xRelayer" },
      }),
    );
    // Then send event arrives
    const result = c.processEvent(
      makeNormalized("message_sent", {
        chain: CANONICAL_SOURCE,
        txHash: "0xSendTx",
        details: {
          destinationBlockchainID: CANONICAL_DEST,
          originSenderAddress: "0xSender",
          destinationAddress: "0xRecipient",
        },
      }),
    );

    expect(result.isNew).toBe(false);
    expect(result.trace.sender).toBe("0xSender");
    expect(result.trace.recipient).toBe("0xRecipient");
    expect(result.trace.sourceTxHash).toBe("0xSendTx");
    expect(result.trace.destination.blockchainId).toBe(CANONICAL_DEST);
  });

  it("receipts_sent attributes the observed source chain and canonicalizes the destination", () => {
    const c = createCorrelator(CHAIN_REGISTRY);
    const result = c.processEvent(
      makeNormalized("receipts_sent", {
        chain: CANONICAL_DEST,
        details: {
          destinationBlockchainID: RAW_SOURCE,
        },
      }),
    );

    expect(result.trace.source.blockchainId).toBe(CANONICAL_DEST);
    expect(result.trace.destination.blockchainId).toBe(CANONICAL_SOURCE);
  });

  it("delivery_confirmed canonicalizes the destination blockchain when present in the payload", () => {
    const c = createCorrelator(CHAIN_REGISTRY);
    const result = c.processEvent(
      makeNormalized("delivery_confirmed", {
        chain: CANONICAL_SOURCE,
        details: {
          sourceBlockchainID: RAW_DEST,
          destinationBlockchainID: RAW_SOURCE,
          originSenderAddress: "0xSender",
          destinationAddress: "0xRecipient",
        },
      }),
    );

    expect(result.trace.source.blockchainId).toBe(CANONICAL_DEST);
    expect(result.trace.destination.blockchainId).toBe(CANONICAL_SOURCE);
    expect(result.trace.sender).toBe("0xSender");
    expect(result.trace.recipient).toBe("0xRecipient");
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
