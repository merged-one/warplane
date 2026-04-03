import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { openDb, closeDb, runMigrations, type Database, getTrace } from "@warplane/storage";
import type { TeleporterEvent } from "../rpc/decoder.js";
import { createPipeline } from "./coordinator.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MSG_ID =
  "0x0000000000000000000000000000000000000000000000000000000000000001" as `0x${string}`;
const DEST_CHAIN =
  "0x0000000000000000000000000000000000000000000000000000000000000002" as `0x${string}`;
const SRC_CHAIN =
  "0x0000000000000000000000000000000000000000000000000000000000000003" as `0x${string}`;
const CHAIN_A = "chain-a";

function makeSendEvent(blockNumber: bigint): TeleporterEvent {
  return {
    eventName: "SendCrossChainMessage",
    args: {
      messageID: MSG_ID,
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

function makeReceiveEvent(blockNumber: bigint): TeleporterEvent {
  return {
    eventName: "ReceiveCrossChainMessage",
    args: {
      messageID: MSG_ID,
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

function makeInitEvent(blockNumber: bigint): TeleporterEvent {
  return {
    eventName: "BlockchainIDInitialized",
    args: { blockchainID: "0xabc" },
    blockNumber,
    transactionHash: `0xtx${blockNumber}`,
    logIndex: 0,
    blockHash: `0xblock${blockNumber}`,
    removed: false,
  };
}

function makeFeeEvent(blockNumber: bigint): TeleporterEvent {
  return {
    eventName: "AddFeeAmount",
    args: {
      messageID: MSG_ID,
      updatedFeeInfo: { feeTokenAddress: "0xFee", amount: 1000n },
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

let db: Database;

beforeEach(() => {
  db = openDb({ path: ":memory:" });
  runMigrations(db);
});

afterEach(() => {
  closeDb(db);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Pipeline Coordinator", () => {
  it("normalizes and correlates a SendCrossChainMessage", async () => {
    const pipeline = createPipeline(db);
    await pipeline.handleEvents(CHAIN_A, [makeSendEvent(1n)]);
    pipeline.flush();

    const stats = pipeline.stats();
    expect(stats.eventsReceived).toBe(1);
    expect(stats.eventsNormalized).toBe(1);
    expect(stats.tracesCreated).toBe(1);
  });

  it("creates a trace stored in DB after flush", async () => {
    const pipeline = createPipeline(db);
    await pipeline.handleEvents(CHAIN_A, [makeSendEvent(1n)]);
    pipeline.flush();

    const trace = getTrace(db, MSG_ID);
    expect(trace).toBeDefined();
    expect(trace!.messageId).toBe(MSG_ID);
    expect(trace!.execution).toBe("pending");
  });

  it("skips BlockchainIDInitialized", async () => {
    const pipeline = createPipeline(db);
    await pipeline.handleEvents(CHAIN_A, [makeInitEvent(1n)]);
    pipeline.flush();

    const stats = pipeline.stats();
    expect(stats.eventsReceived).toBe(1);
    expect(stats.eventsDropped).toBe(1);
    expect(stats.tracesCreated).toBe(0);
  });

  it("handles batch of mixed events", async () => {
    const pipeline = createPipeline(db);
    await pipeline.handleEvents(CHAIN_A, [makeSendEvent(1n), makeInitEvent(2n), makeFeeEvent(3n)]);
    pipeline.flush();

    const stats = pipeline.stats();
    expect(stats.eventsReceived).toBe(3);
    expect(stats.eventsNormalized).toBe(2); // send + fee
    expect(stats.eventsDropped).toBe(1); // init
  });

  it("updates existing trace on delivery_confirmed", async () => {
    const pipeline = createPipeline(db);
    await pipeline.handleEvents(CHAIN_A, [makeSendEvent(1n)]);
    await pipeline.handleEvents("chain-b", [makeReceiveEvent(5n)]);
    pipeline.flush();

    const trace = getTrace(db, MSG_ID);
    expect(trace).toBeDefined();
    expect(trace!.execution).toBe("success");
  });

  it("tracks stats correctly", async () => {
    const pipeline = createPipeline(db);
    await pipeline.handleEvents(CHAIN_A, [makeSendEvent(1n)]);
    await pipeline.handleEvents("chain-b", [makeReceiveEvent(5n)]);

    const stats = pipeline.stats();
    expect(stats.eventsReceived).toBe(2);
    expect(stats.eventsNormalized).toBe(2);
    expect(stats.tracesCreated).toBe(1);
    expect(stats.tracesUpdated).toBe(1);
  });

  it("auto-flushes at writeBatchSize", async () => {
    const pipeline = createPipeline(db, { writeBatchSize: 1 });
    await pipeline.handleEvents(CHAIN_A, [makeSendEvent(1n)]);
    // Should have auto-flushed since writeBatchSize=1

    const trace = getTrace(db, MSG_ID);
    expect(trace).toBeDefined();
  });

  it("flush() persists all pending traces", async () => {
    const pipeline = createPipeline(db);
    await pipeline.handleEvents(CHAIN_A, [makeSendEvent(1n)]);

    // Not flushed yet
    expect(getTrace(db, MSG_ID)).toBeUndefined();

    pipeline.flush();
    expect(getTrace(db, MSG_ID)).toBeDefined();
  });

  it("stop() flushes and prevents further processing", async () => {
    const pipeline = createPipeline(db);
    await pipeline.handleEvents(CHAIN_A, [makeSendEvent(1n)]);
    pipeline.stop();

    // Should be flushed
    expect(getTrace(db, MSG_ID)).toBeDefined();

    // Further events ignored
    await pipeline.handleEvents("chain-b", [makeReceiveEvent(5n)]);
    const stats = pipeline.stats();
    expect(stats.eventsReceived).toBe(1); // only the first batch
  });

  it("handles empty event batches", async () => {
    const pipeline = createPipeline(db);
    await pipeline.handleEvents(CHAIN_A, []);
    pipeline.flush();

    const stats = pipeline.stats();
    expect(stats.eventsReceived).toBe(0);
    expect(stats.tracesCreated).toBe(0);
  });
});
