import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestAdapter, initTestSchema } from "@warplane/storage/test-utils";
import type { DatabaseAdapter } from "@warplane/storage";
import { getTrace } from "@warplane/storage";
import type { TeleporterEvent } from "../rpc/decoder.js";
import { createPipeline } from "./coordinator.js";
import type { AlertEvaluator } from "../alerts/alert-evaluator.js";
import type { ChainRegistry } from "./types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MSG_ID =
  "0x0000000000000000000000000000000000000000000000000000000000000001" as `0x${string}`;
const DEST_CHAIN =
  "0x0000000000000000000000000000000000000000000000000000000000000002" as `0x${string}`;
const SRC_CHAIN =
  "0x0000000000000000000000000000000000000000000000000000000000000003" as `0x${string}`;
const CHAIN_A = "2LFmzhHDKxkreihEtPanVmofuFn63bsh8twnRXEbDhBtCJxURB";
const CHAIN_B = "2q9e4r6Mu3U68nU1fYjgbR6JvwrRx36CohpAX5UQxse55x1Q5";

const CHAIN_REGISTRY: ChainRegistry = new Map([
  [
    CHAIN_A,
    {
      name: "Henesys",
      blockchainId: CHAIN_A,
      subnetId: "",
      evmChainId: 68414,
    },
  ],
  [
    CHAIN_B,
    {
      name: "Mainnet C-Chain",
      blockchainId: CHAIN_B,
      subnetId: "",
      evmChainId: 43114,
    },
  ],
]);

function makeSendEvent(blockNumber: bigint, blockTimestamp?: bigint): TeleporterEvent {
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
    ...(blockTimestamp !== undefined ? { blockTimestamp } : {}),
  };
}

function makeSendEventFor(
  messageId: `0x${string}`,
  blockNumber: bigint,
  blockTimestamp?: bigint,
): TeleporterEvent {
  return {
    ...makeSendEvent(blockNumber, blockTimestamp),
    args: {
      ...makeSendEvent(blockNumber, blockTimestamp).args,
      messageID: messageId,
    },
  };
}

function makeReceiveEvent(blockNumber: bigint, blockTimestamp?: bigint): TeleporterEvent {
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
    ...(blockTimestamp !== undefined ? { blockTimestamp } : {}),
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

describe("Pipeline Coordinator", () => {
  it("normalizes and correlates a SendCrossChainMessage", async () => {
    const pipeline = createPipeline(db);
    await pipeline.handleEvents(CHAIN_A, [makeSendEvent(1n)]);
    await pipeline.flush();

    const stats = pipeline.stats();
    expect(stats.eventsReceived).toBe(1);
    expect(stats.eventsNormalized).toBe(1);
    expect(stats.tracesCreated).toBe(1);
  });

  it("creates a trace stored in DB after flush", async () => {
    const pipeline = createPipeline(db);
    await pipeline.handleEvents(CHAIN_A, [makeSendEvent(1n)]);
    await pipeline.flush();

    const trace = await getTrace(db, MSG_ID);
    expect(trace).toBeDefined();
    expect(trace!.messageId).toBe(MSG_ID);
    expect(trace!.execution).toBe("pending");
  });

  it("skips BlockchainIDInitialized", async () => {
    const pipeline = createPipeline(db);
    await pipeline.handleEvents(CHAIN_A, [makeInitEvent(1n)]);
    await pipeline.flush();

    const stats = pipeline.stats();
    expect(stats.eventsReceived).toBe(1);
    expect(stats.eventsDropped).toBe(1);
    expect(stats.tracesCreated).toBe(0);
  });

  it("handles batch of mixed events", async () => {
    const pipeline = createPipeline(db);
    await pipeline.handleEvents(CHAIN_A, [makeSendEvent(1n), makeInitEvent(2n), makeFeeEvent(3n)]);
    await pipeline.flush();

    const stats = pipeline.stats();
    expect(stats.eventsReceived).toBe(3);
    expect(stats.eventsNormalized).toBe(2); // send + fee
    expect(stats.eventsDropped).toBe(1); // init
  });

  it("updates existing trace on delivery_confirmed", async () => {
    const pipeline = createPipeline(db, { chainRegistry: CHAIN_REGISTRY });
    await pipeline.handleEvents(CHAIN_A, [makeSendEvent(1n)]);
    await pipeline.handleEvents(CHAIN_B, [makeReceiveEvent(5n)]);
    await pipeline.flush();

    const trace = await getTrace(db, MSG_ID);
    expect(trace).toBeDefined();
    expect(trace!.execution).toBe("success");
    expect(trace!.source.blockchainId).toBe(CHAIN_A);
    expect(trace!.destination.blockchainId).toBe(CHAIN_B);
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

  it("persists on-chain block timestamps into trace and event timestamps", async () => {
    const pipeline = createPipeline(db);
    const sendTimestamp = 1_712_188_800n;
    const receiveTimestamp = sendTimestamp + 45n;

    await pipeline.handleEvents(CHAIN_A, [makeSendEvent(1n, sendTimestamp)]);
    await pipeline.handleEvents("chain-b", [makeReceiveEvent(5n, receiveTimestamp)]);
    await pipeline.flush();

    const trace = await getTrace(db, MSG_ID);
    expect(trace).toBeDefined();
    expect(trace!.timestamps.sendTime).toBe(new Date(Number(sendTimestamp) * 1000).toISOString());
    expect(trace!.timestamps.receiveTime).toBe(
      new Date(Number(receiveTimestamp) * 1000).toISOString(),
    );
    expect(trace!.events[0]!.timestamp).toBe(new Date(Number(sendTimestamp) * 1000).toISOString());
    expect(trace!.events[1]!.timestamp).toBe(
      new Date(Number(receiveTimestamp) * 1000).toISOString(),
    );
  });

  it("hydrates a persisted send trace after restart and merges a later delivery event", async () => {
    const firstPipeline = createPipeline(db);
    await firstPipeline.handleEvents(CHAIN_A, [makeSendEvent(1n)]);
    await firstPipeline.flush();
    firstPipeline.stop();

    const restartedPipeline = createPipeline(db);
    await restartedPipeline.handleEvents("chain-b", [makeReceiveEvent(5n)]);
    await restartedPipeline.flush();

    const trace = await getTrace(db, MSG_ID);
    expect(trace).toBeDefined();
    expect(trace!.execution).toBe("success");
    expect(trace!.timestamps.blockSend).toBe(1);
    expect(trace!.timestamps.blockRecv).toBe(5);
    expect(trace!.events.map((event) => event.kind)).toEqual([
      "message_sent",
      "delivery_confirmed",
    ]);
  });

  it("preloads missing traces for a batch with a single lookup query", async () => {
    const preloadSql = "FROM traces\n       WHERE message_id IN (";
    let batchedLookups = 0;
    let singleLookups = 0;

    const wrapAdapter = (adapter: DatabaseAdapter): DatabaseAdapter => ({
      dialect: adapter.dialect,
      async query<T = Record<string, unknown>>(sql: string, params?: unknown[]) {
        if (sql.includes(preloadSql)) {
          batchedLookups++;
        }
        if (sql.includes("SELECT trace_json FROM traces WHERE message_id = ?")) {
          singleLookups++;
        }
        return adapter.query<T>(sql, params);
      },
      execute: (sql, params) => adapter.execute(sql, params),
      exec: (sql) => adapter.exec(sql),
      transaction: (fn) => adapter.transaction((tx) => fn(wrapAdapter(tx))),
      close: () => adapter.close(),
    });

    const countedDb = wrapAdapter(db);
    const pipeline = createPipeline(countedDb, { writeBatchSize: 10 });
    const messageIds = [
      "0x0000000000000000000000000000000000000000000000000000000000000011",
      "0x0000000000000000000000000000000000000000000000000000000000000012",
      "0x0000000000000000000000000000000000000000000000000000000000000013",
    ] as const;

    await pipeline.handleEvents(
      CHAIN_A,
      messageIds.map((messageId, index) => makeSendEventFor(messageId, BigInt(index + 1))),
    );
    await pipeline.flush();

    expect(batchedLookups).toBe(1);
    expect(singleLookups).toBe(0);
  });

  it("hydrates a persisted delivery trace after restart and fills the missing send side", async () => {
    const firstPipeline = createPipeline(db);
    await firstPipeline.handleEvents("chain-b", [makeReceiveEvent(5n)]);
    await firstPipeline.flush();
    firstPipeline.stop();

    const restartedPipeline = createPipeline(db);
    await restartedPipeline.handleEvents(CHAIN_A, [makeSendEvent(1n)]);
    await restartedPipeline.flush();

    const trace = await getTrace(db, MSG_ID);
    expect(trace).toBeDefined();
    expect(trace!.execution).toBe("success");
    expect(trace!.timestamps.blockSend).toBe(1);
    expect(trace!.timestamps.blockRecv).toBe(5);
    expect(trace!.events.map((event) => event.kind)).toEqual([
      "delivery_confirmed",
      "message_sent",
    ]);
  });

  it("auto-flushes at writeBatchSize", async () => {
    const pipeline = createPipeline(db, { writeBatchSize: 1 });
    await pipeline.handleEvents(CHAIN_A, [makeSendEvent(1n)]);
    // Should have auto-flushed since writeBatchSize=1

    const trace = await getTrace(db, MSG_ID);
    expect(trace).toBeDefined();
  });

  it("flush() persists all pending traces", async () => {
    const pipeline = createPipeline(db);
    await pipeline.handleEvents(CHAIN_A, [makeSendEvent(1n)]);

    // Not flushed yet
    expect(await getTrace(db, MSG_ID)).toBeUndefined();

    await pipeline.flush();
    expect(await getTrace(db, MSG_ID)).toBeDefined();
  });

  it("stop() flushes and prevents further processing", async () => {
    const pipeline = createPipeline(db);
    await pipeline.handleEvents(CHAIN_A, [makeSendEvent(1n)]);
    pipeline.stop();

    // Should be flushed
    expect(await getTrace(db, MSG_ID)).toBeDefined();

    // Further events ignored
    await pipeline.handleEvents("chain-b", [makeReceiveEvent(5n)]);
    const stats = pipeline.stats();
    expect(stats.eventsReceived).toBe(1); // only the first batch
  });

  it("handles empty event batches", async () => {
    const pipeline = createPipeline(db);
    await pipeline.handleEvents(CHAIN_A, []);
    await pipeline.flush();

    const stats = pipeline.stats();
    expect(stats.eventsReceived).toBe(0);
    expect(stats.tracesCreated).toBe(0);
  });

  it("calls alertEvaluator.evaluate on state changes", async () => {
    const mockEvaluator: AlertEvaluator = {
      evaluate: vi.fn().mockResolvedValue(undefined),
      refreshRules: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn(),
    };

    const pipeline = createPipeline(db, { alertEvaluator: mockEvaluator });

    // Send event creates a new trace (isNew + isStateChange) — evaluate called
    await pipeline.handleEvents(CHAIN_A, [makeSendEvent(1n)]);
    expect(mockEvaluator.evaluate).toHaveBeenCalledTimes(1);

    // Receive event triggers a state change (pending → success) — evaluate called again
    await pipeline.handleEvents("chain-b", [makeReceiveEvent(5n)]);
    expect(mockEvaluator.evaluate).toHaveBeenCalledTimes(2);

    const lastCall = (mockEvaluator.evaluate as ReturnType<typeof vi.fn>).mock.calls[1]![0];
    expect(lastCall.isStateChange).toBe(true);
    expect(lastCall.newState).toBe("delivered");

    pipeline.stop();
  });

  it("skips alert evaluation when no evaluator configured", async () => {
    // No alertEvaluator in config — should not throw
    const pipeline = createPipeline(db);
    await pipeline.handleEvents(CHAIN_A, [makeSendEvent(1n)]);
    await pipeline.handleEvents("chain-b", [makeReceiveEvent(5n)]);
    await pipeline.flush();

    const trace = await getTrace(db, MSG_ID);
    expect(trace).toBeDefined();
    expect(trace!.execution).toBe("success");

    pipeline.stop();
  });
});
