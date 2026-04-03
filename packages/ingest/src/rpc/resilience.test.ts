/**
 * Resilience tests — verifies error recovery, checkpoint persistence,
 * idempotency, and fault isolation across the ingestion pipeline.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  openDb,
  closeDb,
  runMigrations,
  type Database,
  getCheckpoint,
  upsertCheckpoint,
  getTrace,
  listTraces,
} from "@warplane/storage";
import { createOrchestrator } from "./orchestrator.js";
import type { RpcClient } from "./client.js";
import type { TeleporterEvent } from "./decoder.js";
import { createPipeline } from "../pipeline/coordinator.js";
import type { AlertEvaluator } from "../alerts/alert-evaluator.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MSG_ID =
  "0x0000000000000000000000000000000000000000000000000000000000000001" as `0x${string}`;
const DEST_CHAIN =
  "0x0000000000000000000000000000000000000000000000000000000000000010" as `0x${string}`;
const CHAIN_ID = "chain-test";
const CONTRACT = "0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf";

// ---------------------------------------------------------------------------
// Event factories
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Mock RPC client
// ---------------------------------------------------------------------------

function createMockClient(opts: {
  tipBlock?: bigint;
  failAfterCalls?: number;
  logsPerCall?: TeleporterEvent[][];
}): RpcClient {
  const tipBlock = opts.tipBlock ?? 100n;
  let logCallCount = 0;
  const logsPerCall = opts.logsPerCall ?? [];
  const failAfter = opts.failAfterCalls ?? Infinity;

  return {
    name: "mock-client",
    getBlockNumber: vi.fn().mockImplementation(async () => {
      return tipBlock;
    }),
    getBlockHeader: vi.fn().mockImplementation(async (n: bigint) => ({
      number: n,
      hash: `h${n}`,
      parentHash: `h${n - 1n}`,
    })),
    getLogs: vi.fn().mockImplementation(async () => {
      logCallCount++;
      if (logCallCount > failAfter) {
        throw new Error("RPC connection lost");
      }
      return logsPerCall[logCallCount - 1] ?? [];
    }),
    watchBlocks: vi.fn().mockReturnValue(vi.fn()),
    isHealthy: vi.fn().mockResolvedValue(true),
    destroy: vi.fn().mockResolvedValue(undefined),
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

describe("Resilience", () => {
  it("enters error mode on RPC failure during backfill and preserves checkpoint", async () => {
    // First getLogs call succeeds, second throws
    const client = createMockClient({
      tipBlock: 30000n,
      failAfterCalls: 1,
      logsPerCall: [[makeSendEvent(5n)]],
    });

    const events: TeleporterEvent[] = [];
    const orch = createOrchestrator(db, new Map([[CHAIN_ID, client]]), {
      chains: [{ chainId: CHAIN_ID, contractAddress: CONTRACT }],
      onEvents: (_cid, evts) => {
        events.push(...evts);
      },
      backfillBatchSize: 10_000,
    });

    await orch.start();
    // Wait for orchestrator to settle
    await new Promise((r) => setTimeout(r, 100));
    await orch.stop();

    // Should be in error mode
    const status = orch.status();
    expect(status[0]!.mode).toBe("error");
    expect(status[0]!.error).toContain("RPC connection lost");

    // First batch should have processed and checkpointed
    const cp = getCheckpoint(db, CHAIN_ID, CONTRACT);
    expect(cp).toBeDefined();
    expect(cp!.lastBlock).toBe(10000); // First batch: 0 → 10000
  });

  it("resumes from checkpoint on restart", async () => {
    // Pre-seed a checkpoint at block 5000
    upsertCheckpoint(db, {
      chainId: CHAIN_ID,
      contractAddress: CONTRACT,
      lastBlock: 5000,
      blockHash: "h5000",
    });

    const client = createMockClient({ tipBlock: 5000n });

    const orch = createOrchestrator(db, new Map([[CHAIN_ID, client]]), {
      chains: [
        {
          chainId: CHAIN_ID,
          contractAddress: CONTRACT,
          startBlock: 0n,
        },
      ],
      onEvents: () => {},
      backfillBatchSize: 10_000,
    });

    await orch.start();
    await new Promise((r) => setTimeout(r, 100));
    await orch.stop();

    // getBlockNumber should have been called, but getLogs should NOT because
    // we're already at tip (checkpoint 5000 >= tipBlock 5000)
    expect(client.getBlockNumber).toHaveBeenCalled();
    // Backfill loop: from > to (5001 > 5000), so no getLogs calls needed
    expect(client.getLogs).not.toHaveBeenCalled();
  });

  it("processes duplicate events idempotently — single trace maintained", async () => {
    const pipeline = createPipeline(db, { writeBatchSize: 1 });

    const sendEvent = makeSendEvent(5n);

    // Process same event twice
    await pipeline.handleEvents(CHAIN_ID, [sendEvent]);
    await pipeline.handleEvents(CHAIN_ID, [sendEvent]);
    pipeline.flush();

    // Should still have only one trace (correlator may add event twice
    // but the trace identity is preserved — no duplicate traces)
    const traces = listTraces(db);
    expect(traces.length).toBe(1);
    // State should remain consistent regardless of duplicate processing
    expect(traces[0]!.execution).toBe("pending");
  });

  it("isolates alert evaluation failures from pipeline processing", async () => {
    const failingEvaluator: AlertEvaluator = {
      evaluate: vi.fn().mockRejectedValue(new Error("Alert service down")),
      refreshRules: vi.fn(),
      stop: vi.fn(),
    };

    const pipeline = createPipeline(db, {
      writeBatchSize: 1,
      alertEvaluator: failingEvaluator,
    });

    // This should NOT throw even though evaluator fails
    // The pipeline catches or the evaluate is non-blocking
    await pipeline.handleEvents(CHAIN_ID, [makeSendEvent(5n)]);
    pipeline.flush();

    // Pipeline should have still processed the event
    const trace = getTrace(db, MSG_ID);
    expect(trace).toBeDefined();
  });

  it("handles concurrent chains independently — one error doesn't affect others", async () => {
    const healthyClient = createMockClient({
      tipBlock: 50n,
      logsPerCall: [[makeSendEvent(5n)]],
    });
    const brokenClient = createMockClient({
      tipBlock: 100n,
      failAfterCalls: 0, // Fails immediately
    });

    const events: { chainId: string; events: TeleporterEvent[] }[] = [];
    const orch = createOrchestrator(
      db,
      new Map([
        ["chain-healthy", healthyClient],
        ["chain-broken", brokenClient],
      ]),
      {
        chains: [
          { chainId: "chain-healthy", contractAddress: CONTRACT },
          { chainId: "chain-broken", contractAddress: CONTRACT },
        ],
        onEvents: (cid, evts) => {
          events.push({ chainId: cid, events: evts });
        },
        backfillBatchSize: 10_000,
      },
    );

    await orch.start();
    await new Promise((r) => setTimeout(r, 200));
    await orch.stop();

    const status = orch.status();
    const healthy = status.find((s) => s.chainId === "chain-healthy");
    const broken = status.find((s) => s.chainId === "chain-broken");

    // Broken chain should be in error mode
    expect(broken!.mode).toBe("error");
    // Healthy chain should have completed successfully
    expect(healthy!.mode).not.toBe("error");
  });

  it("auto-flushes when write batch size is reached", async () => {
    // Set a small batch size so we can verify auto-flush
    const pipeline = createPipeline(db, { writeBatchSize: 2 });

    // Generate 2 different message IDs to fill the batch
    const msg2 =
      "0x0000000000000000000000000000000000000000000000000000000000000099" as `0x${string}`;

    const event1 = makeSendEvent(5n);
    const event2: TeleporterEvent = {
      ...makeSendEvent(6n),
      args: {
        ...makeSendEvent(6n).args,
        messageID: msg2,
      },
    };

    await pipeline.handleEvents(CHAIN_ID, [event1, event2]);
    // Don't call flush() — auto-flush should have triggered

    // Both traces should be in storage thanks to auto-flush
    expect(getTrace(db, MSG_ID)).toBeDefined();
    expect(getTrace(db, msg2)).toBeDefined();
  });
});
