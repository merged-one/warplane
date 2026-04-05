import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestAdapter, initTestSchema } from "../test-utils/index.js";
import type { DatabaseAdapter } from "../adapter.js";
import {
  upsertTrace,
  getTracesByMessageIds,
  listTraces,
  countTraces,
  getFailureClassification,
  getDeliveryLatencyStats,
} from "./traces.js";
import type { MessageTrace } from "@warplane/domain";

let db: DatabaseAdapter;

beforeEach(async () => {
  db = createTestAdapter();
  await initTestSchema(db);
});

afterEach(async () => {
  await db.close();
});

// ---------------------------------------------------------------------------
// Helper: create a minimal valid trace
// ---------------------------------------------------------------------------

function makeTrace(overrides: Partial<MessageTrace> & { messageId: string }): MessageTrace {
  return {
    schemaVersion: "1.0.0",
    scenario: "test",
    execution: "success",
    source: {
      name: "chain-a",
      blockchainId: "0xaaa",
      subnetId: "0xsub-a",
      evmChainId: 1,
    },
    destination: {
      name: "chain-b",
      blockchainId: "0xbbb",
      subnetId: "0xsub-b",
      evmChainId: 2,
    },
    sender: "0xsender",
    recipient: "0xrecipient",
    sourceTxHash: "0xtx-source",
    timestamps: {
      sendTime: "2026-04-01T12:00:00.000Z",
      receiveTime: "2026-04-01T12:00:05.000Z",
      blockSend: 100,
    },
    events: [],
    ...overrides,
  } as MessageTrace;
}

describe("trace filtering", () => {
  it("filters by messageId prefix", async () => {
    await upsertTrace(db, makeTrace({ messageId: "msg-alpha" }));
    await upsertTrace(db, makeTrace({ messageId: "msg-beta" }));

    const traces = await listTraces(db, { messageId: "msg-al" });
    const count = await countTraces(db, { messageId: "msg-al" });

    expect(traces).toHaveLength(1);
    expect(traces[0]!.messageId).toBe("msg-alpha");
    expect(count).toBe(1);
  });

  it("treats generic chain filtering as source OR destination", async () => {
    await upsertTrace(
      db,
      makeTrace({
        messageId: "msg-source",
        source: { name: "chain-x", blockchainId: "0xchain-x", subnetId: "subnet-x", evmChainId: 1 },
        destination: {
          name: "chain-y",
          blockchainId: "0xchain-y",
          subnetId: "subnet-y",
          evmChainId: 2,
        },
      }),
    );
    await upsertTrace(
      db,
      makeTrace({
        messageId: "msg-dest",
        source: { name: "chain-z", blockchainId: "0xchain-z", subnetId: "subnet-z", evmChainId: 3 },
        destination: {
          name: "chain-x",
          blockchainId: "0xchain-x",
          subnetId: "subnet-x",
          evmChainId: 1,
        },
      }),
    );

    const traces = await listTraces(db, { chain: "0xchain-x" });
    const count = await countTraces(db, { chain: "0xchain-x" });

    expect(traces.map((trace) => trace.messageId)).toEqual(["msg-source", "msg-dest"]);
    expect(count).toBe(2);
  });

  it("supports newest-first and oldest-first ordering", async () => {
    await upsertTrace(
      db,
      makeTrace({
        messageId: "msg-oldest",
        timestamps: {
          sendTime: "2026-04-01T12:00:00.000Z",
          receiveTime: "2026-04-01T12:00:05.000Z",
          blockSend: 100,
        },
      }),
    );
    await upsertTrace(
      db,
      makeTrace({
        messageId: "msg-middle",
        timestamps: {
          sendTime: "2026-04-01T12:05:00.000Z",
          receiveTime: "2026-04-01T12:05:05.000Z",
          blockSend: 200,
        },
      }),
    );
    await upsertTrace(
      db,
      makeTrace({
        messageId: "msg-newest",
        timestamps: {
          sendTime: "2026-04-01T12:10:00.000Z",
          receiveTime: "2026-04-01T12:10:05.000Z",
          blockSend: 300,
        },
      }),
    );

    const oldestFirst = await listTraces(db, { sort: "oldest" });
    const newestFirst = await listTraces(db, { sort: "newest" });

    expect(oldestFirst.map((trace) => trace.messageId)).toEqual([
      "msg-oldest",
      "msg-middle",
      "msg-newest",
    ]);
    expect(newestFirst.map((trace) => trace.messageId)).toEqual([
      "msg-newest",
      "msg-middle",
      "msg-oldest",
    ]);
  });
});

describe("getTracesByMessageIds", () => {
  it("returns the latest trace for each requested message ID", async () => {
    await upsertTrace(
      db,
      makeTrace({
        messageId: "msg-alpha",
        scenario: "old",
        execution: "pending",
      }),
    );
    await upsertTrace(
      db,
      makeTrace({
        messageId: "msg-alpha",
        scenario: "test",
        execution: "success",
      }),
    );
    await upsertTrace(db, makeTrace({ messageId: "msg-beta", execution: "failed" }));

    const traces = await getTracesByMessageIds(db, ["msg-alpha", "msg-beta", "missing"]);

    expect(traces.size).toBe(2);
    expect(traces.get("msg-alpha")?.execution).toBe("success");
    expect(traces.get("msg-beta")?.execution).toBe("failed");
  });

  it("returns an empty map when no message IDs are provided", async () => {
    const traces = await getTracesByMessageIds(db, []);
    expect(traces.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getFailureClassification
// ---------------------------------------------------------------------------

describe("getFailureClassification", () => {
  it("returns grouped failure reasons", async () => {
    // Insert traces with execution_failed events
    await upsertTrace(
      db,
      makeTrace({
        messageId: "msg-1",
        events: [
          {
            kind: "message_sent",
            timestamp: "2026-04-01T12:00:00Z",
            blockNumber: 100,
            txHash: "0x1",
            chain: "source",
          },
          {
            kind: "execution_failed",
            timestamp: "2026-04-01T12:00:03Z",
            blockNumber: 200,
            txHash: "0xf1",
            chain: "dest",
            details: "insufficient_fee",
          },
        ],
      }),
    );
    await upsertTrace(
      db,
      makeTrace({
        messageId: "msg-2",
        events: [
          {
            kind: "message_sent",
            timestamp: "2026-04-01T12:00:01Z",
            blockNumber: 101,
            txHash: "0x2",
            chain: "source",
          },
          {
            kind: "execution_failed",
            timestamp: "2026-04-01T12:00:04Z",
            blockNumber: 201,
            txHash: "0xf2",
            chain: "dest",
            details: "insufficient_fee",
          },
        ],
      }),
    );
    await upsertTrace(
      db,
      makeTrace({
        messageId: "msg-3",
        events: [
          {
            kind: "message_sent",
            timestamp: "2026-04-01T12:00:02Z",
            blockNumber: 102,
            txHash: "0x3",
            chain: "source",
          },
          {
            kind: "execution_failed",
            timestamp: "2026-04-01T12:00:05Z",
            blockNumber: 202,
            txHash: "0xf3",
            chain: "dest",
            details: "gas_limit",
          },
        ],
      }),
    );

    const result = await getFailureClassification(db);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ reason: "insufficient_fee", count: 2 });
    expect(result[1]).toEqual({ reason: "gas_limit", count: 1 });
  });

  it("respects since filter", async () => {
    await upsertTrace(
      db,
      makeTrace({
        messageId: "msg-old",
        events: [
          {
            kind: "execution_failed",
            timestamp: "2026-03-01T12:00:00Z",
            blockNumber: 50,
            txHash: "0xold",
            chain: "dest",
            details: "old_error",
          },
        ],
      }),
    );
    await upsertTrace(
      db,
      makeTrace({
        messageId: "msg-new",
        events: [
          {
            kind: "execution_failed",
            timestamp: "2026-04-01T12:00:00Z",
            blockNumber: 100,
            txHash: "0xnew",
            chain: "dest",
            details: "new_error",
          },
        ],
      }),
    );

    const result = await getFailureClassification(db, { since: "2026-03-15T00:00:00Z" });
    expect(result).toHaveLength(1);
    expect(result[0]!.reason).toBe("new_error");
  });

  it("returns empty array when no failures", async () => {
    await upsertTrace(
      db,
      makeTrace({
        messageId: "msg-ok",
        events: [
          {
            kind: "message_sent",
            timestamp: "2026-04-01T12:00:00Z",
            blockNumber: 100,
            txHash: "0x1",
            chain: "source",
          },
        ],
      }),
    );

    const result = await getFailureClassification(db);
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getDeliveryLatencyStats
// ---------------------------------------------------------------------------

describe("getDeliveryLatencyStats", () => {
  it("computes correct percentiles", async () => {
    // Insert 10 completed traces with varying latencies
    for (let i = 0; i < 10; i++) {
      const sendTime = `2026-04-01T12:00:0${i}.000Z`;
      const latencySec = i + 1; // 1s to 10s
      const receiveDate = new Date(new Date(sendTime).getTime() + latencySec * 1000);
      await upsertTrace(
        db,
        makeTrace({
          messageId: `msg-${i}`,
          execution: "success",
          timestamps: {
            sendTime,
            receiveTime: receiveDate.toISOString(),
            blockSend: 100 + i,
            blockRecv: 200 + i,
          },
          events: [
            {
              kind: "message_sent",
              timestamp: sendTime,
              blockNumber: 100 + i,
              txHash: `0x${i}`,
              chain: "source",
            },
          ],
        }),
      );
    }

    const stats = await getDeliveryLatencyStats(db);
    // julianday arithmetic has sub-ms precision loss, so use closeTo
    // p50 of [~1000, ~2000, ..., ~10000] → 5th value ≈ 5000ms
    expect(stats.p50).toBeGreaterThanOrEqual(4999);
    expect(stats.p50).toBeLessThanOrEqual(5001);
    // p90 → 9th value ≈ 9000ms
    expect(stats.p90).toBeGreaterThanOrEqual(8999);
    expect(stats.p90).toBeLessThanOrEqual(9001);
    // p99 → 10th value ≈ 10000ms
    expect(stats.p99).toBeGreaterThanOrEqual(9999);
    expect(stats.p99).toBeLessThanOrEqual(10001);
  });

  it("returns time-series points", async () => {
    // Two traces in same hour
    await upsertTrace(
      db,
      makeTrace({
        messageId: "msg-a",
        execution: "success",
        timestamps: {
          sendTime: "2026-04-01T12:00:00.000Z",
          receiveTime: "2026-04-01T12:00:02.000Z",
          blockSend: 100,
          blockRecv: 101,
        },
        events: [],
      }),
    );
    await upsertTrace(
      db,
      makeTrace({
        messageId: "msg-b",
        execution: "success",
        timestamps: {
          sendTime: "2026-04-01T12:30:00.000Z",
          receiveTime: "2026-04-01T12:30:04.000Z",
          blockSend: 200,
          blockRecv: 201,
        },
        events: [],
      }),
    );

    const stats = await getDeliveryLatencyStats(db);
    expect(stats.timeSeries.length).toBe(1); // same hour bucket
    expect(stats.timeSeries[0]!.time).toBe("2026-04-01T12");
    // average of ~2000 + ~4000, julianday has sub-ms precision loss
    expect(stats.timeSeries[0]!.latencyMs).toBeGreaterThanOrEqual(2999);
    expect(stats.timeSeries[0]!.latencyMs).toBeLessThanOrEqual(3001);
  });

  it("handles no completed traces", async () => {
    // Insert a pending trace (no receiveTime match)
    await upsertTrace(
      db,
      makeTrace({
        messageId: "msg-pending",
        execution: "pending",
        timestamps: {
          sendTime: "2026-04-01T12:00:00.000Z",
          receiveTime: "2026-04-01T12:00:00.000Z", // same as send = excluded
          blockSend: 100,
        },
        events: [],
      }),
    );

    const stats = await getDeliveryLatencyStats(db);
    expect(stats.p50).toBe(0);
    expect(stats.p90).toBe(0);
    expect(stats.p99).toBe(0);
    expect(stats.timeSeries).toEqual([]);
  });

  it("excludes partial success traces with unknown send blocks", async () => {
    await upsertTrace(
      db,
      makeTrace({
        messageId: "msg-partial-success",
        execution: "success",
        timestamps: {
          sendTime: "1970-01-01T00:00:00.000Z",
          receiveTime: "2026-04-01T12:00:05.000Z",
          blockSend: 0,
          blockRecv: 123,
        },
        events: [],
      }),
    );

    const stats = await getDeliveryLatencyStats(db);
    expect(stats).toEqual({ p50: 0, p90: 0, p99: 0, timeSeries: [] });
  });
});
