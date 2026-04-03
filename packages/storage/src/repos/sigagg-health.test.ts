import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestAdapter, initTestSchema } from "../test-utils/index.js";
import type { DatabaseAdapter } from "../adapter.js";
import {
  insertSigAggHealth,
  getLatestSigAggHealth,
  listSigAggHealthHistory,
} from "./sigagg-health.js";

let db: DatabaseAdapter;

beforeEach(async () => {
  db = createTestAdapter();
  await initTestSchema(db);
});

afterEach(async () => {
  await db.close();
});

describe("SigAggHealth repository", () => {
  it("inserts and retrieves a health snapshot", async () => {
    const id = await insertSigAggHealth(db, {
      status: "healthy",
      aggregationLatency: 2000,
      connectedStake: { "subnet-a": 90, "subnet-b": 85 },
      cacheHitRate: 80,
      snapshotJson: '{"full":"snapshot"}',
    });
    expect(id).toBeGreaterThan(0);

    const latest = await getLatestSigAggHealth(db);
    expect(latest).toBeDefined();
    expect(latest!.status).toBe("healthy");
    expect(latest!.aggregationLatency).toBe(2000);
    expect(latest!.connectedStake).toEqual({ "subnet-a": 90, "subnet-b": 85 });
    expect(latest!.cacheHitRate).toBe(80);
  });

  it("returns undefined when no snapshots exist", async () => {
    const latest = await getLatestSigAggHealth(db);
    expect(latest).toBeUndefined();
  });

  it("getLatest returns most recent snapshot", async () => {
    await insertSigAggHealth(db, {
      status: "healthy",
      snapshotJson: '{"v":1}',
    });
    await insertSigAggHealth(db, {
      status: "degraded",
      snapshotJson: '{"v":2}',
    });

    const latest = await getLatestSigAggHealth(db);
    expect(latest!.status).toBe("degraded");
  });

  it("lists history with limit", async () => {
    for (let i = 0; i < 5; i++) {
      await insertSigAggHealth(db, {
        status: "healthy",
        snapshotJson: `{"v":${i}}`,
      });
    }

    const history = await listSigAggHealthHistory(db, { limit: 3 });
    expect(history).toHaveLength(3);
  });

  it("handles null optional fields", async () => {
    await insertSigAggHealth(db, {
      status: "unhealthy",
      snapshotJson: "{}",
    });

    const latest = await getLatestSigAggHealth(db);
    expect(latest!.aggregationLatency).toBeNull();
    expect(latest!.connectedStake).toEqual({});
    expect(latest!.cacheHitRate).toBeNull();
  });
});
