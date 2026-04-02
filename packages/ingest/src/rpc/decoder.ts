/**
 * Decodes raw EVM logs into typed TeleporterMessenger event objects.
 *
 * Pure functions — no I/O. Uses viem's `decodeEventLog` with the
 * TeleporterMessenger ABI for full type-safe decoding.
 */

import { decodeEventLog } from "viem";
import { teleporterMessengerAbi } from "./abi.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Raw EVM log as returned by eth_getLogs / viem. */
export interface RawLog {
  address: string;
  topics: [string, ...string[]];
  data: string;
  blockNumber: bigint;
  transactionHash: string;
  logIndex: number;
  blockHash: string;
  removed: boolean;
}

/** Metadata attached to every decoded event. */
export interface LogMeta {
  blockNumber: bigint;
  transactionHash: string;
  logIndex: number;
  blockHash: string;
  removed: boolean;
}

/** Decoded TeleporterMessenger event — discriminated by `eventName`. */
export type TeleporterEvent = {
  eventName: string;
  args: Record<string, unknown>;
} & LogMeta;

// ---------------------------------------------------------------------------
// Decoder
// ---------------------------------------------------------------------------

/**
 * Decode a single raw EVM log into a typed TeleporterEvent.
 * Returns `undefined` if the log does not match any TeleporterMessenger event.
 */
export function decodeTeleporterLog(log: RawLog): TeleporterEvent | undefined {
  try {
    const decoded = decodeEventLog({
      abi: teleporterMessengerAbi,
      data: log.data as `0x${string}`,
      topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
    });

    return {
      eventName: decoded.eventName,
      args: decoded.args as unknown as Record<string, unknown>,
      blockNumber: log.blockNumber,
      transactionHash: log.transactionHash,
      logIndex: log.logIndex,
      blockHash: log.blockHash,
      removed: log.removed,
    };
  } catch {
    return undefined;
  }
}

/**
 * Batch decode raw logs, filtering out non-TeleporterMessenger entries.
 */
export function decodeTeleporterLogs(logs: RawLog[]): TeleporterEvent[] {
  const results: TeleporterEvent[] = [];
  for (const log of logs) {
    const decoded = decodeTeleporterLog(log);
    if (decoded) results.push(decoded);
  }
  return results;
}
