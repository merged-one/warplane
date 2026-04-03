import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { openDb, closeDb, type Database } from "../db.js";
import { runMigrations } from "../migrate.js";
import { upsertTrace, getFailureClassification, getDeliveryLatencyStats } from "./traces.js";
import type { MessageTrace } from "@warplane/domain";

let db: Database;

beforeEach(() => {
  db = openDb({ path: ":memory:" });
  runMigrations(db);
});

afterEach(() => {
  closeDb(db);
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

// ---------------------------------------------------------------------------
// getFailureClassification
// ---------------------------------------------------------------------------

describe("getFailureClassification", () => {
  it("returns grouped failure reasons", () => {
    // Insert traces with execution_failed events
    upsertTrace(
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
    upsertTrace(
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
    upsertTrace(
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

    const result = getFailureClassification(db);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ reason: "insufficient_fee", count: 2 });
    expect(result[1]).toEqual({ reason: "gas_limit", count: 1 });
  });

  it("respects since filter", () => {
    upsertTrace(
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
    upsertTrace(
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

    const result = getFailureClassification(db, { since: "2026-03-15T00:00:00Z" });
    expect(result).toHaveLength(1);
    expect(result[0]!.reason).toBe("new_error");
  });

  it("returns empty array when no failures", () => {
    upsertTrace(
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

    const result = getFailureClassification(db);
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getDeliveryLatencyStats
// ---------------------------------------------------------------------------

describe("getDeliveryLatencyStats", () => {
  it("computes correct percentiles", () => {
    // Insert 10 completed traces with varying latencies
    for (let i = 0; i < 10; i++) {
      const sendTime = `2026-04-01T12:00:0${i}.000Z`;
      const latencySec = i + 1; // 1s to 10s
      const receiveDate = new Date(new Date(sendTime).getTime() + latencySec * 1000);
      upsertTrace(
        db,
        makeTrace({
          messageId: `msg-${i}`,
          execution: "success",
          timestamps: {
            sendTime,
            receiveTime: receiveDate.toISOString(),
            blockSend: 100 + i,
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

    const stats = getDeliveryLatencyStats(db);
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

  it("returns time-series points", () => {
    // Two traces in same hour
    upsertTrace(
      db,
      makeTrace({
        messageId: "msg-a",
        execution: "success",
        timestamps: {
          sendTime: "2026-04-01T12:00:00.000Z",
          receiveTime: "2026-04-01T12:00:02.000Z",
          blockSend: 100,
        },
        events: [],
      }),
    );
    upsertTrace(
      db,
      makeTrace({
        messageId: "msg-b",
        execution: "success",
        timestamps: {
          sendTime: "2026-04-01T12:30:00.000Z",
          receiveTime: "2026-04-01T12:30:04.000Z",
          blockSend: 200,
        },
        events: [],
      }),
    );

    const stats = getDeliveryLatencyStats(db);
    expect(stats.timeSeries.length).toBe(1); // same hour bucket
    expect(stats.timeSeries[0]!.time).toBe("2026-04-01T12");
    // average of ~2000 + ~4000, julianday has sub-ms precision loss
    expect(stats.timeSeries[0]!.latencyMs).toBeGreaterThanOrEqual(2999);
    expect(stats.timeSeries[0]!.latencyMs).toBeLessThanOrEqual(3001);
  });

  it("handles no completed traces", () => {
    // Insert a pending trace (no receiveTime match)
    upsertTrace(
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

    const stats = getDeliveryLatencyStats(db);
    expect(stats.p50).toBe(0);
    expect(stats.p90).toBe(0);
    expect(stats.p99).toBe(0);
    expect(stats.timeSeries).toEqual([]);
  });
});
