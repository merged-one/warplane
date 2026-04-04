/**
 * Sliding-window block tracker for reorg detection.
 *
 * Maintains a window of recent block headers. When a new block arrives,
 * checks parentHash continuity to detect chain reorganizations.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BlockHeader {
  number: bigint;
  hash: string;
  parentHash: string;
  timestamp: bigint;
}

export interface ReorgResult {
  /** The last valid block before the fork. */
  forkBlock: bigint;
  /** Hashes of blocks that were invalidated by the reorg. */
  invalidatedHashes: string[];
  /** Number of blocks invalidated. */
  depth: number;
}

// ---------------------------------------------------------------------------
// BlockTracker
// ---------------------------------------------------------------------------

export class BlockTracker {
  private readonly windowSize: number;
  private readonly headers: BlockHeader[] = [];

  constructor(opts: { windowSize: number }) {
    this.windowSize = opts.windowSize;
  }

  /**
   * Push a new block header. Returns a ReorgResult if a reorganization
   * is detected, or null for normal chain advancement.
   *
   * Returns null for the very first block (no parent to verify).
   */
  push(header: BlockHeader): ReorgResult | null {
    // First block — nothing to compare against
    if (this.headers.length === 0) {
      this.headers.push(header);
      this.evict();
      return null;
    }

    const currentTip = this.headers[this.headers.length - 1]!;

    // Gap detection — if the new block is not the immediate successor,
    // treat as a reset (e.g., after restart with a large gap)
    if (header.number > currentTip.number + 1n) {
      this.headers.length = 0;
      this.headers.push(header);
      return null;
    }

    // Normal advancement — parentHash matches current tip
    if (header.parentHash === currentTip.hash) {
      this.headers.push(header);
      this.evict();
      return null;
    }

    // Reorg detected — walk back to find the fork point
    const invalidated: string[] = [];
    let forkIdx = this.headers.length - 1;

    while (forkIdx >= 0) {
      const h = this.headers[forkIdx]!;
      if (h.number < header.number && h.hash === header.parentHash) {
        break;
      }
      invalidated.push(h.hash);
      forkIdx--;
    }

    // If we walked past the beginning of our window, the reorg is deeper
    // than our window. Reset and accept the new block.
    if (forkIdx < 0) {
      const depth = invalidated.length;
      this.headers.length = 0;
      this.headers.push(header);
      return {
        forkBlock: header.number - BigInt(depth),
        invalidatedHashes: invalidated,
        depth,
      };
    }

    // Truncate invalidated blocks and push the new chain tip
    const forkBlock = this.headers[forkIdx]!.number;
    this.headers.length = forkIdx + 1;
    this.headers.push(header);
    this.evict();

    return {
      forkBlock,
      invalidatedHashes: invalidated,
      depth: invalidated.length,
    };
  }

  /** The latest block number in the window, or undefined if empty. */
  get tip(): bigint | undefined {
    return this.headers.length > 0 ? this.headers[this.headers.length - 1]!.number : undefined;
  }

  /** Number of headers currently in the window. */
  get size(): number {
    return this.headers.length;
  }

  /** Get the hash of a specific block number, or undefined if not in window. */
  getHash(blockNumber: bigint): string | undefined {
    const h = this.headers.find((h) => h.number === blockNumber);
    return h?.hash;
  }

  /** Clear all tracked headers. */
  clear(): void {
    this.headers.length = 0;
  }

  private evict(): void {
    while (this.headers.length > this.windowSize) {
      this.headers.shift();
    }
  }
}
