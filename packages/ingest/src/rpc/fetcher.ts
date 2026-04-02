/**
 * Event Fetcher — fetches TeleporterMessenger events with auto-pagination.
 *
 * Splits large block ranges into chunks and bisects on oversized responses.
 * Uses the RPC client for I/O and the decoder for type-safe event parsing.
 */

import type { Log } from "viem";
import type { RpcClient } from "./client.js";
import { decodeTeleporterLogs, type TeleporterEvent, type RawLog } from "./decoder.js";
import { TELEPORTER_MESSENGER_ADDRESS } from "./abi.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FetcherConfig {
  /** Max block range per eth_getLogs call (default: 100_000). */
  maxBlockRange?: number;
  /** Contract address to filter (default: canonical TeleporterMessenger). */
  contractAddress?: string;
}

export interface FetchResult {
  events: TeleporterEvent[];
  /** Actual block range fetched (may differ if paginated). */
  fromBlock: bigint;
  toBlock: bigint;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a viem Log to our RawLog shape. */
function toRawLog(log: Log): RawLog {
  return {
    address: log.address,
    topics: log.topics as [string, ...string[]],
    data: log.data,
    blockNumber: log.blockNumber ?? 0n,
    transactionHash: log.transactionHash ?? "0x",
    logIndex: log.logIndex ?? 0,
    blockHash: log.blockHash ?? "0x",
    removed: log.removed ?? false,
  };
}

/** Check if an error indicates the response was too large. */
function isResponseTooLarge(err: unknown): boolean {
  const msg = String(err);
  return (
    msg.includes("response size is too large") ||
    msg.includes("query returned more than") ||
    msg.includes("Log response size exceeded") ||
    msg.includes("exceed maximum block range")
  );
}

// ---------------------------------------------------------------------------
// Fetcher
// ---------------------------------------------------------------------------

/**
 * Fetch TeleporterMessenger events for a block range, with automatic
 * pagination (chunking) and bisection on oversized responses.
 */
export async function fetchTeleporterEvents(
  client: RpcClient,
  fromBlock: bigint,
  toBlock: bigint,
  config?: FetcherConfig,
): Promise<FetchResult> {
  const maxRange = BigInt(config?.maxBlockRange ?? 100_000);
  const address = config?.contractAddress ?? TELEPORTER_MESSENGER_ADDRESS;
  const allEvents: TeleporterEvent[] = [];

  // Split into chunks of maxRange
  let cursor = fromBlock;
  while (cursor <= toBlock) {
    const chunkEnd = cursor + maxRange - 1n < toBlock ? cursor + maxRange - 1n : toBlock;
    const events = await fetchRange(client, address, cursor, chunkEnd);
    allEvents.push(...events);
    cursor = chunkEnd + 1n;
  }

  return { events: allEvents, fromBlock, toBlock };
}

/**
 * Fetch a single range, bisecting if the response is too large.
 */
async function fetchRange(
  client: RpcClient,
  address: string,
  from: bigint,
  to: bigint,
): Promise<TeleporterEvent[]> {
  try {
    const logs = await client.getLogs({ address, fromBlock: from, toBlock: to });
    return decodeTeleporterLogs(logs.map(toRawLog));
  } catch (err) {
    if (isResponseTooLarge(err) && from < to) {
      // Bisect the range
      const mid = from + (to - from) / 2n;
      const left = await fetchRange(client, address, from, mid);
      const right = await fetchRange(client, address, mid + 1n, to);
      return [...left, ...right];
    }
    throw err;
  }
}
