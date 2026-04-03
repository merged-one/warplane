import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestAdapter, initTestSchema } from "../test-utils/index.js";
import type { DatabaseAdapter } from "../adapter.js";
import {
  insertRelayerHealth,
  getLatestRelayerHealth,
  listRelayerHealthHistory,
} from "./relayer-health.js";

let db: DatabaseAdapter;

beforeEach(async () => {
  db = createTestAdapter();
  await initTestSchema(db);
});

afterEach(async () => {
  await db.close();
});

describe("RelayerHealth repository", () => {
  it("inserts and retrieves a health snapshot", async () => {
    const id = await insertRelayerHealth(db, {
      relayerId: "relayer-1",
      status: "healthy",
      successRate: 99.5,
      latencyMs: 500,
      lagBlocks: 2,
      pendingMessages: 5,
      topFailures: [{ reason: "gas", count: 1 }],
      snapshotJson: '{"full":"snapshot"}',
    });
    expect(id).toBeGreaterThan(0);

    const latest = await getLatestRelayerHealth(db, "relayer-1");
    expect(latest).toBeDefined();
    expect(latest!.relayerId).toBe("relayer-1");
    expect(latest!.status).toBe("healthy");
    expect(latest!.successRate).toBe(99.5);
    expect(latest!.latencyMs).toBe(500);
    expect(latest!.lagBlocks).toBe(2);
    expect(latest!.pendingMessages).toBe(5);
    expect(latest!.topFailures).toEqual([{ reason: "gas", count: 1 }]);
  });

  it("returns undefined for unknown relayer", async () => {
    const latest = await getLatestRelayerHealth(db, "nonexistent");
    expect(latest).toBeUndefined();
  });

  it("getLatest returns most recent snapshot", async () => {
    await insertRelayerHealth(db, {
      relayerId: "relayer-1",
      status: "healthy",
      snapshotJson: '{"v":1}',
    });
    await insertRelayerHealth(db, {
      relayerId: "relayer-1",
      status: "degraded",
      snapshotJson: '{"v":2}',
    });

    const latest = await getLatestRelayerHealth(db, "relayer-1");
    expect(latest!.status).toBe("degraded");
  });

  it("lists history with limit", async () => {
    for (let i = 0; i < 5; i++) {
      await insertRelayerHealth(db, {
        relayerId: "relayer-1",
        status: "healthy",
        snapshotJson: `{"v":${i}}`,
      });
    }

    const history = await listRelayerHealthHistory(db, "relayer-1", { limit: 3 });
    expect(history).toHaveLength(3);
  });

  it("handles null optional fields", async () => {
    await insertRelayerHealth(db, {
      relayerId: "relayer-1",
      status: "unhealthy",
      snapshotJson: "{}",
    });

    const latest = await getLatestRelayerHealth(db, "relayer-1");
    expect(latest!.successRate).toBeNull();
    expect(latest!.latencyMs).toBeNull();
    expect(latest!.topFailures).toEqual([]);
  });
});
