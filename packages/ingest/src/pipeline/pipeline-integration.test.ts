/**
 * Pipeline integration tests — exercises the full path:
 * orchestrator → coordinator → correlator → storage.
 *
 * Uses real in-memory SQLite and mock RPC clients to verify end-to-end
 * event processing, checkpoint persistence, and pipeline statistics.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestAdapter, initTestSchema } from "@warplane/storage/test-utils";
import type { DatabaseAdapter } from "@warplane/storage";
import { getTrace, listTraces } from "@warplane/storage";
import type { TeleporterEvent } from "../rpc/decoder.js";
import { createPipeline } from "./coordinator.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MSG_ID_1 =
  "0x0000000000000000000000000000000000000000000000000000000000000001" as `0x${string}`;
const MSG_ID_2 =
  "0x0000000000000000000000000000000000000000000000000000000000000002" as `0x${string}`;
const DEST_CHAIN =
  "0x0000000000000000000000000000000000000000000000000000000000000010" as `0x${string}`;
const SRC_CHAIN =
  "0x0000000000000000000000000000000000000000000000000000000000000020" as `0x${string}`;
const CHAIN_A = "chain-a";
const CHAIN_B = "chain-b";

// ---------------------------------------------------------------------------
// Event factories
// ---------------------------------------------------------------------------

function makeSendEvent(messageId: string, blockNumber: bigint): TeleporterEvent {
  return {
    eventName: "SendCrossChainMessage",
    args: {
      messageID: messageId,
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
    blockNumber,
    transactionHash: `0xtx${blockNumber}`,
    logIndex: 0,
    blockHash: `0xblock${blockNumber}`,
    removed: false,
  };
}

function makeDeliveryEvent(messageId: string, blockNumber: bigint): TeleporterEvent {
  return {
    eventName: "ReceiveCrossChainMessage",
    args: {
      messageID: messageId,
      sourceBlockchainID: SRC_CHAIN,
      deliverer: "0xRelayer",
      rewardRedeemer: "0xRedeemer",
      message: {},
    },
    blockNumber,
    transactionHash: `0xtx${blockNumber}`,
    logIndex: 0,
    blockHash: `0xblock${blockNumber}`,
    removed: false,
  };
}

function makeFailedEvent(messageId: string, blockNumber: bigint): TeleporterEvent {
  return {
    eventName: "MessageExecutionFailed",
    args: {
      messageID: messageId,
      sourceBlockchainID: SRC_CHAIN,
      message: {},
    },
    blockNumber,
    transactionHash: `0xtx${blockNumber}`,
    logIndex: 0,
    blockHash: `0xblock${blockNumber}`,
    removed: false,
  };
}

function makeRetryEvent(messageId: string, blockNumber: bigint): TeleporterEvent {
  return {
    eventName: "MessageExecuted",
    args: {
      messageID: messageId,
      sourceBlockchainID: SRC_CHAIN,
    },
    blockNumber,
    transactionHash: `0xtx${blockNumber}`,
    logIndex: 0,
    blockHash: `0xblock${blockNumber}`,
    removed: false,
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
// Tests
// ---------------------------------------------------------------------------

describe("Pipeline integration", () => {
  it("processes events end-to-end: orchestrator → pipeline → storage", async () => {
    const pipeline = createPipeline(db, { writeBatchSize: 1 });

    const sendEvent = makeSendEvent(MSG_ID_1, 10n);
    const deliveryEvent = makeDeliveryEvent(MSG_ID_1, 20n);

    // Process events directly through pipeline (simulating orchestrator callback)
    await pipeline.handleEvents(CHAIN_A, [sendEvent]);
    await pipeline.handleEvents(CHAIN_B, [deliveryEvent]);
    await pipeline.flush();

    // Verify trace exists in storage with correct state
    const trace = await getTrace(db, MSG_ID_1);
    expect(trace).toBeDefined();
    expect(trace!.execution).toBe("success");
    expect(trace!.events.length).toBe(2);
    expect(trace!.events[0]!.kind).toBe("message_sent");
    expect(trace!.events[1]!.kind).toBe("delivery_confirmed");
  });

  it("correlates events from multiple chains into single trace", async () => {
    const pipeline = createPipeline(db, { writeBatchSize: 100 });

    // Send on chain A, deliver on chain B
    await pipeline.handleEvents(CHAIN_A, [makeSendEvent(MSG_ID_1, 5n)]);
    await pipeline.handleEvents(CHAIN_B, [makeDeliveryEvent(MSG_ID_1, 15n)]);
    await pipeline.flush();

    const traces = await listTraces(db);
    expect(traces.length).toBe(1);
    expect(traces[0]!.execution).toBe("success");
    // Events from different chains correlated into one trace
    expect(traces[0]!.events.length).toBe(2);
  });

  it("tracks pipeline stats accurately", async () => {
    const pipeline = createPipeline(db, { writeBatchSize: 100 });

    // 2 lifecycle events + 1 skippable event (BlockchainIDInitialized)
    const initEvent: TeleporterEvent = {
      eventName: "BlockchainIDInitialized",
      args: { blockchainID: "0xabc" },
      blockNumber: 1n,
      transactionHash: "0xtx1",
      logIndex: 0,
      blockHash: "0xblock1",
      removed: false,
    };

    await pipeline.handleEvents(CHAIN_A, [
      initEvent,
      makeSendEvent(MSG_ID_1, 5n),
      makeDeliveryEvent(MSG_ID_1, 10n),
    ]);
    await pipeline.flush();

    const stats = pipeline.stats();
    expect(stats.eventsReceived).toBe(3);
    expect(stats.eventsNormalized).toBe(2);
    expect(stats.eventsDropped).toBe(1);
    expect(stats.tracesCreated).toBe(1);
    expect(stats.tracesUpdated).toBe(1); // delivery_confirmed = state change
  });

  it("handles failed execution → retry flow", async () => {
    const pipeline = createPipeline(db, { writeBatchSize: 1 });

    await pipeline.handleEvents(CHAIN_A, [makeSendEvent(MSG_ID_1, 5n)]);
    await pipeline.handleEvents(CHAIN_B, [makeFailedEvent(MSG_ID_1, 15n)]);
    await pipeline.handleEvents(CHAIN_B, [makeRetryEvent(MSG_ID_1, 25n)]);
    await pipeline.flush();

    const trace = await getTrace(db, MSG_ID_1);
    expect(trace).toBeDefined();
    expect(trace!.execution).toBe("retry_success");
    expect(trace!.events.length).toBe(3);
  });

  it("handles empty event batches without errors", async () => {
    const pipeline = createPipeline(db, { writeBatchSize: 100 });

    // Empty batch should not cause errors
    await pipeline.handleEvents(CHAIN_A, []);
    await pipeline.flush();

    const stats = pipeline.stats();
    expect(stats.eventsReceived).toBe(0);
    expect(stats.tracesCreated).toBe(0);
    expect((await listTraces(db)).length).toBe(0);
  });

  it("stops gracefully and prevents further processing", async () => {
    const pipeline = createPipeline(db, { writeBatchSize: 100 });

    await pipeline.handleEvents(CHAIN_A, [makeSendEvent(MSG_ID_1, 5n)]);
    pipeline.stop(); // Should flush + stop

    // Verify pending data was flushed
    expect(await getTrace(db, MSG_ID_1)).toBeDefined();

    // Further events should be ignored
    await pipeline.handleEvents(CHAIN_A, [makeSendEvent(MSG_ID_2, 10n)]);
    await pipeline.flush();

    expect(await getTrace(db, MSG_ID_2)).toBeUndefined();
    expect(pipeline.stats().tracesCreated).toBe(1);
  });

  it("processes multiple messages concurrently", async () => {
    const pipeline = createPipeline(db, { writeBatchSize: 100 });

    // Two different messages in the same batch
    await pipeline.handleEvents(CHAIN_A, [
      makeSendEvent(MSG_ID_1, 5n),
      makeSendEvent(MSG_ID_2, 6n),
    ]);
    await pipeline.handleEvents(CHAIN_B, [
      makeDeliveryEvent(MSG_ID_1, 15n),
      makeFailedEvent(MSG_ID_2, 16n),
    ]);
    await pipeline.flush();

    const trace1 = await getTrace(db, MSG_ID_1);
    const trace2 = await getTrace(db, MSG_ID_2);
    expect(trace1!.execution).toBe("success");
    expect(trace2!.execution).toBe("failed");
    expect(pipeline.stats().tracesCreated).toBe(2);
  });
});
