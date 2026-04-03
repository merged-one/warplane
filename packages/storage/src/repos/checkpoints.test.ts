import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestAdapter, initTestSchema } from "../test-utils/index.js";
import type { DatabaseAdapter } from "../adapter.js";
import {
  upsertCheckpoint,
  getCheckpoint,
  deleteCheckpoint,
  listCheckpoints,
} from "./checkpoints.js";

let db: DatabaseAdapter;

beforeEach(async () => {
  db = createTestAdapter();
  await initTestSchema(db);
});

afterEach(async () => {
  await db.close();
});

describe("checkpoints migration", () => {
  it("creates the checkpoints table with correct columns", async () => {
    const result = await db.query<{ name: string }>("PRAGMA table_info(checkpoints)");
    const columns = result.rows.map((c) => c.name);
    expect(columns).toContain("chain_id");
    expect(columns).toContain("contract_address");
    expect(columns).toContain("last_block");
    expect(columns).toContain("block_hash");
    expect(columns).toContain("updated_at");
  });
});

describe("checkpoints repo", () => {
  it("upserts a new checkpoint", async () => {
    await upsertCheckpoint(db, {
      chainId: "chain-a",
      contractAddress: "0xabc",
      lastBlock: 100,
      blockHash: "0xhash100",
    });

    const cp = await getCheckpoint(db, "chain-a", "0xabc");
    expect(cp).toBeDefined();
    expect(cp!.lastBlock).toBe(100);
    expect(cp!.blockHash).toBe("0xhash100");
    expect(cp!.updatedAt).toBeDefined();
  });

  it("updates an existing checkpoint on conflict", async () => {
    await upsertCheckpoint(db, {
      chainId: "chain-a",
      contractAddress: "0xabc",
      lastBlock: 100,
      blockHash: "0xhash100",
    });

    await upsertCheckpoint(db, {
      chainId: "chain-a",
      contractAddress: "0xabc",
      lastBlock: 200,
      blockHash: "0xhash200",
    });

    const cp = await getCheckpoint(db, "chain-a", "0xabc");
    expect(cp!.lastBlock).toBe(200);
    expect(cp!.blockHash).toBe("0xhash200");
  });

  it("retrieves a checkpoint by chainId and contractAddress", async () => {
    await upsertCheckpoint(db, {
      chainId: "chain-a",
      contractAddress: "0xabc",
      lastBlock: 50,
      blockHash: "0xh50",
    });
    await upsertCheckpoint(db, {
      chainId: "chain-b",
      contractAddress: "0xdef",
      lastBlock: 99,
      blockHash: "0xh99",
    });

    const cpA = await getCheckpoint(db, "chain-a", "0xabc");
    const cpB = await getCheckpoint(db, "chain-b", "0xdef");
    expect(cpA!.lastBlock).toBe(50);
    expect(cpB!.lastBlock).toBe(99);
  });

  it("returns undefined for non-existent checkpoint", async () => {
    expect(await getCheckpoint(db, "no-chain", "0x000")).toBeUndefined();
  });

  it("deletes a checkpoint", async () => {
    await upsertCheckpoint(db, {
      chainId: "chain-a",
      contractAddress: "0xabc",
      lastBlock: 100,
      blockHash: "0xhash",
    });

    await deleteCheckpoint(db, "chain-a", "0xabc");
    expect(await getCheckpoint(db, "chain-a", "0xabc")).toBeUndefined();
  });

  it("delete is a no-op for non-existent checkpoint", async () => {
    // Should not throw
    await deleteCheckpoint(db, "nonexistent", "0x000");
  });

  it("lists all checkpoints across chains", async () => {
    await upsertCheckpoint(db, {
      chainId: "chain-a",
      contractAddress: "0xabc",
      lastBlock: 10,
      blockHash: "0xa",
    });
    await upsertCheckpoint(db, {
      chainId: "chain-b",
      contractAddress: "0xdef",
      lastBlock: 20,
      blockHash: "0xb",
    });

    const all = await listCheckpoints(db);
    expect(all).toHaveLength(2);
    expect(all.map((c) => c.chainId).sort()).toEqual(["chain-a", "chain-b"]);
  });
});
