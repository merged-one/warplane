import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { openDb, closeDb, type Database } from "../db.js";
import { runMigrations } from "../migrate.js";
import {
  upsertCheckpoint,
  getCheckpoint,
  deleteCheckpoint,
  listCheckpoints,
} from "./checkpoints.js";

let db: Database;

beforeEach(() => {
  db = openDb({ path: ":memory:" });
  runMigrations(db);
});

afterEach(() => {
  closeDb(db);
});

describe("checkpoints migration", () => {
  it("creates the checkpoints table with correct columns", () => {
    const info = db.prepare("PRAGMA table_info(checkpoints)").all() as Array<{
      name: string;
    }>;
    const columns = info.map((c) => c.name);
    expect(columns).toContain("chain_id");
    expect(columns).toContain("contract_address");
    expect(columns).toContain("last_block");
    expect(columns).toContain("block_hash");
    expect(columns).toContain("updated_at");
  });

  it("is idempotent -- running migrations twice is safe", () => {
    // runMigrations was already called in beforeEach; call again
    const applied = runMigrations(db);
    expect(applied).toHaveLength(0);
  });
});

describe("checkpoints repo", () => {
  it("upserts a new checkpoint", () => {
    upsertCheckpoint(db, {
      chainId: "chain-a",
      contractAddress: "0xabc",
      lastBlock: 100,
      blockHash: "0xhash100",
    });

    const cp = getCheckpoint(db, "chain-a", "0xabc");
    expect(cp).toBeDefined();
    expect(cp!.lastBlock).toBe(100);
    expect(cp!.blockHash).toBe("0xhash100");
    expect(cp!.updatedAt).toBeDefined();
  });

  it("updates an existing checkpoint on conflict", () => {
    upsertCheckpoint(db, {
      chainId: "chain-a",
      contractAddress: "0xabc",
      lastBlock: 100,
      blockHash: "0xhash100",
    });

    upsertCheckpoint(db, {
      chainId: "chain-a",
      contractAddress: "0xabc",
      lastBlock: 200,
      blockHash: "0xhash200",
    });

    const cp = getCheckpoint(db, "chain-a", "0xabc");
    expect(cp!.lastBlock).toBe(200);
    expect(cp!.blockHash).toBe("0xhash200");
  });

  it("retrieves a checkpoint by chainId and contractAddress", () => {
    upsertCheckpoint(db, {
      chainId: "chain-a",
      contractAddress: "0xabc",
      lastBlock: 50,
      blockHash: "0xh50",
    });
    upsertCheckpoint(db, {
      chainId: "chain-b",
      contractAddress: "0xdef",
      lastBlock: 99,
      blockHash: "0xh99",
    });

    const cpA = getCheckpoint(db, "chain-a", "0xabc");
    const cpB = getCheckpoint(db, "chain-b", "0xdef");
    expect(cpA!.lastBlock).toBe(50);
    expect(cpB!.lastBlock).toBe(99);
  });

  it("returns undefined for non-existent checkpoint", () => {
    expect(getCheckpoint(db, "no-chain", "0x000")).toBeUndefined();
  });

  it("deletes a checkpoint", () => {
    upsertCheckpoint(db, {
      chainId: "chain-a",
      contractAddress: "0xabc",
      lastBlock: 100,
      blockHash: "0xhash",
    });

    deleteCheckpoint(db, "chain-a", "0xabc");
    expect(getCheckpoint(db, "chain-a", "0xabc")).toBeUndefined();
  });

  it("delete is a no-op for non-existent checkpoint", () => {
    // Should not throw
    deleteCheckpoint(db, "nonexistent", "0x000");
  });

  it("lists all checkpoints across chains", () => {
    upsertCheckpoint(db, {
      chainId: "chain-a",
      contractAddress: "0xabc",
      lastBlock: 10,
      blockHash: "0xa",
    });
    upsertCheckpoint(db, {
      chainId: "chain-b",
      contractAddress: "0xdef",
      lastBlock: 20,
      blockHash: "0xb",
    });

    const all = listCheckpoints(db);
    expect(all).toHaveLength(2);
    expect(all.map((c) => c.chainId).sort()).toEqual(["chain-a", "chain-b"]);
  });
});
