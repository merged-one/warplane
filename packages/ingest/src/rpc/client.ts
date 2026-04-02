/**
 * RPC Client — thin typed wrapper around viem for Avalanche L1 interaction.
 *
 * Provides the minimal surface needed by the ingestion engine:
 * getBlockNumber, getBlockHeader, getLogs, watchBlocks, isHealthy, destroy.
 *
 * All retry/backoff logic lives here so callers can stay simple.
 */

import {
  createPublicClient,
  http,
  webSocket,
  type PublicClient,
  type Transport,
  type Log,
  type WatchBlockNumberReturnType,
} from "viem";
import type { BlockHeader } from "./block-tracker.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RpcClientConfig {
  /** Human-readable name for logging. */
  name: string;
  /** HTTP RPC endpoint URL. */
  rpcUrl: string;
  /** Optional WebSocket endpoint for subscriptions. */
  wsUrl?: string;
  /** Max retries per request (default: 3). */
  maxRetries?: number;
  /** Base delay in ms for exponential backoff (default: 1000). */
  baseRetryDelayMs?: number;
}

export interface RpcClient {
  /** Get the latest block number. */
  getBlockNumber(): Promise<bigint>;
  /** Get a block header by number. */
  getBlockHeader(blockNumber: bigint): Promise<BlockHeader>;
  /** Fetch logs matching the given filter. */
  getLogs(params: {
    address: string;
    fromBlock: bigint;
    toBlock: bigint;
    topics?: (`0x${string}` | null)[];
  }): Promise<Log[]>;
  /** Subscribe to new block numbers. Returns an unsubscribe function. */
  watchBlocks(onBlock: (blockNumber: bigint) => void): WatchBlockNumberReturnType;
  /** Health check — returns true if the RPC endpoint responds. */
  isHealthy(): Promise<boolean>;
  /** Tear down transports and subscriptions. */
  destroy(): Promise<void>;
  /** The chain name from config. */
  readonly name: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  baseDelay: number,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        const delay = baseDelay * 2 ** attempt;
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createRpcClient(config: RpcClientConfig): RpcClient {
  const maxRetries = config.maxRetries ?? 3;
  const baseDelay = config.baseRetryDelayMs ?? 1000;

  const httpClient: PublicClient = createPublicClient({
    transport: http(config.rpcUrl),
  });

  let wsClient: PublicClient | undefined;
  if (config.wsUrl) {
    wsClient = createPublicClient({
      transport: webSocket(config.wsUrl) as Transport,
    });
  }

  let destroyed = false;

  return {
    name: config.name,

    async getBlockNumber(): Promise<bigint> {
      return withRetry(() => httpClient.getBlockNumber(), maxRetries, baseDelay);
    },

    async getBlockHeader(blockNumber: bigint): Promise<BlockHeader> {
      const block = await withRetry(
        () => httpClient.getBlock({ blockNumber }),
        maxRetries,
        baseDelay,
      );
      return {
        number: block.number,
        hash: block.hash,
        parentHash: block.parentHash,
      };
    },

    async getLogs(params): Promise<Log[]> {
      return withRetry(
        () =>
          httpClient.getLogs({
            address: params.address as `0x${string}`,
            fromBlock: params.fromBlock,
            toBlock: params.toBlock,
          } as Parameters<typeof httpClient.getLogs>[0]),
        maxRetries,
        baseDelay,
      );
    },

    watchBlocks(onBlock): WatchBlockNumberReturnType {
      const client = wsClient ?? httpClient;
      return client.watchBlockNumber({
        onBlockNumber: onBlock,
        poll: true as const,
        pollingInterval: 2_000,
      });
    },

    async isHealthy(): Promise<boolean> {
      try {
        await httpClient.getBlockNumber();
        return true;
      } catch {
        return false;
      }
    },

    async destroy(): Promise<void> {
      if (destroyed) return;
      destroyed = true;
      // viem transports clean up on GC, but we can stop the ws client
      if (wsClient) {
        wsClient.transport.value?.close?.();
      }
    },
  };
}
