import { describe, it, expect } from "vitest";
import { BlockTracker, type BlockHeader } from "./block-tracker.js";

function header(n: number, hash: string, parentHash: string): BlockHeader {
  return { number: BigInt(n), hash, parentHash, timestamp: BigInt(n) };
}

describe("BlockTracker", () => {
  it("tracks sequential blocks without detecting reorg", () => {
    const tracker = new BlockTracker({ windowSize: 10 });
    expect(tracker.push(header(1, "h1", "h0"))).toBeNull();
    expect(tracker.push(header(2, "h2", "h1"))).toBeNull();
    expect(tracker.push(header(3, "h3", "h2"))).toBeNull();
    expect(tracker.size).toBe(3);
  });

  it("returns tip as the latest pushed block number", () => {
    const tracker = new BlockTracker({ windowSize: 10 });
    tracker.push(header(10, "h10", "h9"));
    tracker.push(header(11, "h11", "h10"));
    expect(tracker.tip).toBe(11n);
  });

  it("detects a 1-block reorg and returns invalidated hash", () => {
    const tracker = new BlockTracker({ windowSize: 10 });
    tracker.push(header(1, "h1", "h0"));
    tracker.push(header(2, "h2", "h1"));
    tracker.push(header(3, "h3", "h2"));

    // Reorg: new block 3 with different hash but same parent as block 2
    const result = tracker.push(header(3, "h3-new", "h2"));
    expect(result).not.toBeNull();
    expect(result!.depth).toBe(1);
    expect(result!.invalidatedHashes).toEqual(["h3"]);
    expect(result!.forkBlock).toBe(2n);
  });

  it("detects a 3-block deep reorg and returns all invalidated hashes", () => {
    const tracker = new BlockTracker({ windowSize: 10 });
    tracker.push(header(1, "h1", "h0"));
    tracker.push(header(2, "h2", "h1"));
    tracker.push(header(3, "h3", "h2"));
    tracker.push(header(4, "h4", "h3"));
    tracker.push(header(5, "h5", "h4"));

    // Reorg back to block 2: new block 3 with parent h2
    const result = tracker.push(header(3, "h3-fork", "h2"));
    expect(result).not.toBeNull();
    expect(result!.depth).toBe(3);
    expect(result!.invalidatedHashes).toEqual(["h5", "h4", "h3"]);
    expect(result!.forkBlock).toBe(2n);
  });

  it("evicts blocks older than windowSize", () => {
    const tracker = new BlockTracker({ windowSize: 3 });
    tracker.push(header(1, "h1", "h0"));
    tracker.push(header(2, "h2", "h1"));
    tracker.push(header(3, "h3", "h2"));
    tracker.push(header(4, "h4", "h3"));

    expect(tracker.size).toBe(3);
    // Block 1 should be evicted
    expect(tracker.getHash(1n)).toBeUndefined();
    expect(tracker.getHash(2n)).toBe("h2");
  });

  it("reports correct forkBlock for a reorg", () => {
    const tracker = new BlockTracker({ windowSize: 10 });
    tracker.push(header(10, "h10", "h9"));
    tracker.push(header(11, "h11", "h10"));
    tracker.push(header(12, "h12", "h11"));

    const result = tracker.push(header(12, "h12-new", "h11"));
    expect(result).not.toBeNull();
    expect(result!.forkBlock).toBe(11n);
  });

  it("handles push after clear() as a fresh start", () => {
    const tracker = new BlockTracker({ windowSize: 10 });
    tracker.push(header(1, "h1", "h0"));
    tracker.push(header(2, "h2", "h1"));
    tracker.clear();

    expect(tracker.size).toBe(0);
    expect(tracker.tip).toBeUndefined();

    // First push after clear should not detect reorg
    expect(tracker.push(header(5, "h5", "h4"))).toBeNull();
    expect(tracker.tip).toBe(5n);
  });

  it("getHash returns undefined for blocks outside the window", () => {
    const tracker = new BlockTracker({ windowSize: 10 });
    tracker.push(header(1, "h1", "h0"));
    expect(tracker.getHash(1n)).toBe("h1");
    expect(tracker.getHash(999n)).toBeUndefined();
  });

  it("returns null for the very first block (no parent to check)", () => {
    const tracker = new BlockTracker({ windowSize: 10 });
    const result = tracker.push(header(1, "h1", "h0"));
    expect(result).toBeNull();
  });

  it("handles gap in block numbers gracefully (treats as reset)", () => {
    const tracker = new BlockTracker({ windowSize: 10 });
    tracker.push(header(1, "h1", "h0"));
    tracker.push(header(2, "h2", "h1"));

    // Jump from block 2 to block 100 — gap
    const result = tracker.push(header(100, "h100", "h99"));
    expect(result).toBeNull();
    expect(tracker.tip).toBe(100n);
    // Window should be reset
    expect(tracker.size).toBe(1);
  });
});
