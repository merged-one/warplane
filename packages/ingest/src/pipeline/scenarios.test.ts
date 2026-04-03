/**
 * Golden scenario tests — end-to-end integration through the full pipeline.
 *
 * Each test creates a pipeline with an in-memory DB and feeds realistic
 * event sequences to verify correct trace assembly.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestAdapter, initTestSchema } from "@warplane/storage/test-utils";
import type { DatabaseAdapter } from "@warplane/storage";
import { getTrace } from "@warplane/storage";
import { createPipeline } from "./coordinator.js";
import type { TeleporterEvent } from "../rpc/decoder.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MSG_1 = "0x0000000000000000000000000000000000000000000000000000000000000001" as `0x${string}`;
const MSG_2 = "0x0000000000000000000000000000000000000000000000000000000000000099" as `0x${string}`;
const DEST_CHAIN =
  "0x0000000000000000000000000000000000000000000000000000000000000002" as `0x${string}`;
const SRC_CHAIN =
  "0x0000000000000000000000000000000000000000000000000000000000000003" as `0x${string}`;

// ---------------------------------------------------------------------------
// Event factories
// ---------------------------------------------------------------------------

function meta(blockNumber: bigint, logIndex = 0) {
  return {
    blockNumber,
    transactionHash: `0xtx${blockNumber}`,
    logIndex,
    blockHash: `0xblock${blockNumber}`,
    removed: false,
  };
}

function sendEvent(msgId: string, block: bigint): TeleporterEvent {
  return {
    eventName: "SendCrossChainMessage",
    args: {
      messageID: msgId,
      destinationBlockchainID: DEST_CHAIN,
      message: {
        messageNonce: 1n,
        originSenderAddress: "0xSender",
        destinationBlockchainID: DEST_CHAIN,
        destinationAddress: "0xRecipient",
        requiredGasLimit: 100000n,
        allowedRelayerAddresses: [],
        receipts: [],
        message: "0x",
      },
      feeInfo: { feeTokenAddress: "0xFee", amount: 500n },
    },
    ...meta(block),
  };
}

function receiveEvent(msgId: string, block: bigint): TeleporterEvent {
  return {
    eventName: "ReceiveCrossChainMessage",
    args: {
      messageID: msgId,
      sourceBlockchainID: SRC_CHAIN,
      deliverer: "0xRelayer",
      rewardRedeemer: "0xRedeemer",
      message: {},
    },
    ...meta(block),
  };
}

function receiptEvent(msgId: string, block: bigint): TeleporterEvent {
  return {
    eventName: "ReceiptReceived",
    args: {
      messageID: msgId,
      destinationBlockchainID: DEST_CHAIN,
      relayerRewardAddress: "0xRelayerReward",
      feeInfo: { feeTokenAddress: "0xFee", amount: 200n },
    },
    ...meta(block),
  };
}

function failEvent(msgId: string, block: bigint): TeleporterEvent {
  return {
    eventName: "MessageExecutionFailed",
    args: {
      messageID: msgId,
      sourceBlockchainID: SRC_CHAIN,
      message: { messageNonce: 1n },
    },
    ...meta(block),
  };
}

function retryEvent(msgId: string, block: bigint): TeleporterEvent {
  return {
    eventName: "MessageExecuted",
    args: {
      messageID: msgId,
      sourceBlockchainID: SRC_CHAIN,
    },
    ...meta(block),
  };
}

function feeEvent(msgId: string, block: bigint): TeleporterEvent {
  return {
    eventName: "AddFeeAmount",
    args: {
      messageID: msgId,
      updatedFeeInfo: { feeTokenAddress: "0xFee", amount: 1000n },
    },
    ...meta(block),
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let db: DatabaseAdapter;

beforeEach(async () => {
  db = createTestAdapter();
  await initTestSchema(db);
});

afterEach(async () => {
  await db.close();
});

// ---------------------------------------------------------------------------
// Golden Scenarios
// ---------------------------------------------------------------------------

describe("Golden Scenarios", () => {
  it("happy path: send → deliver → receipt", async () => {
    const pipeline = createPipeline(db);

    await pipeline.handleEvents("chain-a", [sendEvent(MSG_1, 10n)]);
    await pipeline.handleEvents("chain-b", [receiveEvent(MSG_1, 20n)]);
    await pipeline.handleEvents("chain-a", [receiptEvent(MSG_1, 30n)]);
    await pipeline.flush();

    const trace = await getTrace(db, MSG_1);
    expect(trace).toBeDefined();
    expect(trace!.execution).toBe("success");
    expect(trace!.receiptDelivered).toBe(true);
    expect(trace!.events).toHaveLength(3);
  });

  it("failed execution: send → fail → retry → succeed → receipt", async () => {
    const pipeline = createPipeline(db);

    await pipeline.handleEvents("chain-a", [sendEvent(MSG_1, 10n)]);
    await pipeline.handleEvents("chain-b", [failEvent(MSG_1, 20n)]);
    // retry_requested not emitted by contract — the correlator handles
    // MessageExecuted as retry_succeeded when state is failed
    await pipeline.handleEvents("chain-b", [retryEvent(MSG_1, 25n)]);
    await pipeline.handleEvents("chain-a", [receiptEvent(MSG_1, 30n)]);
    await pipeline.flush();

    const trace = await getTrace(db, MSG_1);
    expect(trace).toBeDefined();
    // After failed → retry_succeeded → receipted (via receipt)
    // receipted maps to "success" execution; the retry path is recorded in events
    expect(trace!.execution).toBe("success");
    expect(trace!.events).toHaveLength(4);
  });

  it("fee top-up: send → add_fee → deliver", async () => {
    const pipeline = createPipeline(db);

    await pipeline.handleEvents("chain-a", [sendEvent(MSG_1, 10n)]);
    await pipeline.handleEvents("chain-a", [feeEvent(MSG_1, 15n)]);
    await pipeline.handleEvents("chain-b", [receiveEvent(MSG_1, 20n)]);
    await pipeline.flush();

    const trace = await getTrace(db, MSG_1);
    expect(trace).toBeDefined();
    expect(trace!.fee).toBeDefined();
    expect(trace!.fee!.feeTokenAddress).toBe("0xFee");
    expect(trace!.execution).toBe("success");
  });

  it("replay blocked: send then execution_failed (replay)", async () => {
    const pipeline = createPipeline(db);

    await pipeline.handleEvents("chain-a", [sendEvent(MSG_1, 10n)]);
    // execution_failed transitions from pending → failed
    await pipeline.handleEvents("chain-b", [failEvent(MSG_1, 20n)]);
    await pipeline.flush();

    const trace = await getTrace(db, MSG_1);
    expect(trace).toBeDefined();
    expect(trace!.execution).toBe("failed");
  });

  it("partial trace: delivery before send (backfill order)", async () => {
    const pipeline = createPipeline(db);

    // Delivery arrives first (destination chain backfill completes first)
    await pipeline.handleEvents("chain-b", [receiveEvent(MSG_1, 20n)]);
    await pipeline.flush();

    let trace = await getTrace(db, MSG_1);
    expect(trace).toBeDefined();
    expect(trace!.execution).toBe("success");

    // Then source chain backfill delivers the send event
    await pipeline.handleEvents("chain-a", [sendEvent(MSG_1, 10n)]);
    await pipeline.flush();

    trace = await getTrace(db, MSG_1);
    expect(trace!.sender).toBe("0xSender");
    expect(trace!.recipient).toBe("0xRecipient");
    expect(trace!.events).toHaveLength(2);
  });

  it("multi-chain: two messages, no cross-contamination", async () => {
    const pipeline = createPipeline(db);

    await pipeline.handleEvents("chain-a", [sendEvent(MSG_1, 10n), sendEvent(MSG_2, 11n)]);
    await pipeline.handleEvents("chain-b", [receiveEvent(MSG_1, 20n)]);
    await pipeline.flush();

    const trace1 = await getTrace(db, MSG_1);
    const trace2 = await getTrace(db, MSG_2);

    expect(trace1).toBeDefined();
    expect(trace2).toBeDefined();
    expect(trace1!.execution).toBe("success");
    expect(trace2!.execution).toBe("pending");
    expect(trace1!.events).toHaveLength(2);
    expect(trace2!.events).toHaveLength(1);
  });

  it("multiple events in single batch", async () => {
    const pipeline = createPipeline(db);

    await pipeline.handleEvents("chain-a", [sendEvent(MSG_1, 10n), feeEvent(MSG_1, 11n)]);
    await pipeline.handleEvents("chain-b", [receiveEvent(MSG_1, 20n)]);
    await pipeline.flush();

    const trace = await getTrace(db, MSG_1);
    expect(trace).toBeDefined();
    expect(trace!.events).toHaveLength(3);
    expect(trace!.fee).toBeDefined();
    expect(trace!.execution).toBe("success");
  });

  it("removed-flag events (reorg markers) handled gracefully", async () => {
    const pipeline = createPipeline(db);

    const reorgedEvent: TeleporterEvent = {
      ...sendEvent(MSG_1, 10n),
      removed: true,
    };

    // The normalizer should still produce an event; the pipeline doesn't
    // special-case removed=true (reorg handling is the orchestrator's job).
    await pipeline.handleEvents("chain-a", [reorgedEvent]);
    await pipeline.flush();

    const stats = pipeline.stats();
    expect(stats.eventsReceived).toBe(1);
    expect(stats.eventsNormalized).toBe(1);
  });
});
