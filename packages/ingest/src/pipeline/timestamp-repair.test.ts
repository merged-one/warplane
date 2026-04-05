import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestAdapter, initTestSchema } from "@warplane/storage/test-utils";
import { getTrace, upsertTrace, type DatabaseAdapter } from "@warplane/storage";
import type { MessageTrace } from "@warplane/domain";
import { repairPlaceholderTraceTimestamps } from "./timestamp-repair.js";
import type { RpcClient } from "../rpc/client.js";

const PLACEHOLDER_TRACE_TIMESTAMP = "1970-01-01T00:00:00.000Z";

let db: DatabaseAdapter;

beforeEach(async () => {
  db = createTestAdapter();
  await initTestSchema(db);
});

afterEach(async () => {
  await db.close();
});

function makeTrace(overrides: Partial<MessageTrace> & { messageId: string }): MessageTrace {
  return {
    schemaVersion: "1.0.0",
    scenario: "on-chain",
    execution: "success",
    source: {
      name: "chain-a",
      blockchainId: "chain-a",
      subnetId: "",
      evmChainId: 1,
    },
    destination: {
      name: "chain-b",
      blockchainId: "chain-b",
      subnetId: "",
      evmChainId: 2,
    },
    sender: "0xsender",
    recipient: "0xrecipient",
    sourceTxHash: "0xsource",
    destinationTxHash: "0xdestination",
    timestamps: {
      sendTime: PLACEHOLDER_TRACE_TIMESTAMP,
      receiveTime: PLACEHOLDER_TRACE_TIMESTAMP,
      blockSend: 100,
      blockRecv: 200,
    },
    events: [
      {
        kind: "message_sent",
        timestamp: PLACEHOLDER_TRACE_TIMESTAMP,
        blockNumber: 100,
        txHash: "0xsource",
        chain: "chain-a",
      },
      {
        kind: "delivery_confirmed",
        timestamp: PLACEHOLDER_TRACE_TIMESTAMP,
        blockNumber: 200,
        txHash: "0xdestination",
        chain: "chain-b",
      },
    ],
    ...overrides,
  } as MessageTrace;
}

function makeClient(timestamps: Record<number, bigint>): Pick<RpcClient, "getBlockHeader"> {
  return {
    getBlockHeader: vi.fn(async (blockNumber: bigint) => ({
      number: blockNumber,
      hash: `0x${blockNumber.toString(16)}`,
      parentHash: "0xparent",
      timestamp: timestamps[Number(blockNumber)] ?? 0n,
    })),
  };
}

describe("repairPlaceholderTraceTimestamps", () => {
  it("repairs placeholder trace and event timestamps from block headers", async () => {
    await upsertTrace(db, makeTrace({ messageId: "msg-1" }));

    const chainAClient = makeClient({ 100: 1_712_188_800n });
    const chainBClient = makeClient({ 200: 1_712_188_845n });
    const result = await repairPlaceholderTraceTimestamps(
      db,
      new Map([
        ["chain-a", chainAClient],
        ["chain-b", chainBClient],
      ]),
    );

    expect(result).toEqual({ scanned: 1, repaired: 1 });

    const trace = await getTrace(db, "msg-1");
    expect(trace).toBeDefined();
    expect(trace!.timestamps.sendTime).toBe("2024-04-04T00:00:00.000Z");
    expect(trace!.timestamps.receiveTime).toBe("2024-04-04T00:00:45.000Z");
    expect(trace!.events[0]!.timestamp).toBe("2024-04-04T00:00:00.000Z");
    expect(trace!.events[1]!.timestamp).toBe("2024-04-04T00:00:45.000Z");
    expect(chainAClient.getBlockHeader).toHaveBeenCalledWith(100n);
    expect(chainBClient.getBlockHeader).toHaveBeenCalledWith(200n);
  });

  it("leaves traces unchanged when no matching RPC client is configured", async () => {
    await upsertTrace(db, makeTrace({ messageId: "msg-2" }));

    const result = await repairPlaceholderTraceTimestamps(db, new Map());

    expect(result).toEqual({ scanned: 1, repaired: 0 });

    const trace = await getTrace(db, "msg-2");
    expect(trace).toBeDefined();
    expect(trace!.timestamps.sendTime).toBe(PLACEHOLDER_TRACE_TIMESTAMP);
    expect(trace!.timestamps.receiveTime).toBe(PLACEHOLDER_TRACE_TIMESTAMP);
  });

  it("repairs receiveTime from execution_failed when delivery_confirmed is absent", async () => {
    await upsertTrace(
      db,
      makeTrace({
        messageId: "msg-3",
        execution: "failed",
        events: [
          {
            kind: "message_sent",
            timestamp: PLACEHOLDER_TRACE_TIMESTAMP,
            blockNumber: 100,
            txHash: "0xsource",
            chain: "chain-a",
          },
          {
            kind: "execution_failed",
            timestamp: PLACEHOLDER_TRACE_TIMESTAMP,
            blockNumber: 200,
            txHash: "0xfailed",
            chain: "chain-b",
          },
        ],
      }),
    );

    const result = await repairPlaceholderTraceTimestamps(
      db,
      new Map([
        ["chain-a", makeClient({ 100: 1_712_188_800n })],
        ["chain-b", makeClient({ 200: 1_712_188_845n })],
      ]),
    );

    expect(result).toEqual({ scanned: 1, repaired: 1 });

    const trace = await getTrace(db, "msg-3");
    expect(trace).toBeDefined();
    expect(trace!.timestamps.receiveTime).toBe("2024-04-04T00:00:45.000Z");
    expect(trace!.events[1]!.kind).toBe("execution_failed");
    expect(trace!.events[1]!.timestamp).toBe("2024-04-04T00:00:45.000Z");
  });

  it("keeps the earliest repaired receive-side timestamp during retries", async () => {
    await upsertTrace(
      db,
      makeTrace({
        messageId: "msg-4",
        execution: "retry_success",
        events: [
          {
            kind: "message_sent",
            timestamp: PLACEHOLDER_TRACE_TIMESTAMP,
            blockNumber: 100,
            txHash: "0xsource",
            chain: "chain-a",
          },
          {
            kind: "execution_failed",
            timestamp: PLACEHOLDER_TRACE_TIMESTAMP,
            blockNumber: 200,
            txHash: "0xfailed",
            chain: "chain-b",
          },
          {
            kind: "retry_succeeded",
            timestamp: PLACEHOLDER_TRACE_TIMESTAMP,
            blockNumber: 201,
            txHash: "0xretry",
            chain: "chain-b",
          },
        ],
      }),
    );

    const result = await repairPlaceholderTraceTimestamps(
      db,
      new Map([
        ["chain-a", makeClient({ 100: 1_712_188_800n })],
        ["chain-b", makeClient({ 200: 1_712_188_845n, 201: 1_712_188_900n })],
      ]),
    );

    expect(result).toEqual({ scanned: 1, repaired: 1 });

    const trace = await getTrace(db, "msg-4");
    expect(trace).toBeDefined();
    expect(trace!.timestamps.receiveTime).toBe("2024-04-04T00:00:45.000Z");
    expect(trace!.events[1]!.timestamp).toBe("2024-04-04T00:00:45.000Z");
    expect(trace!.events[2]!.timestamp).toBe("2024-04-04T00:01:40.000Z");
  });
});
