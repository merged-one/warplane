/**
 * Orchestrator — multi-chain coordinator for RPC ingestion.
 *
 * Manages per-chain lifecycle with dual-mode operation:
 * 1. Backfill: fetch historical events from checkpoint to chain tip
 * 2. Live: subscribe to new blocks and fetch events in real-time
 *
 * Persists checkpoints after each batch and handles reorgs via BlockTracker.
 */

import type { Database } from "@warplane/storage";
import { upsertCheckpoint, getCheckpoint } from "@warplane/storage";
import type { RpcClient } from "./client.js";
import { BlockTracker } from "./block-tracker.js";
import { fetchTeleporterEvents } from "./fetcher.js";
import type { TeleporterEvent } from "./decoder.js";
import type { FetcherConfig } from "./fetcher.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChainMode = "backfill" | "live" | "stopped" | "error";

export interface ChainConfig {
  /** Avalanche blockchain ID (used as checkpoint key). */
  chainId: string;
  /** Contract address to watch. */
  contractAddress: string;
  /** Block to start backfill from (if no checkpoint exists). */
  startBlock?: bigint;
  /** Fetcher config overrides. */
  fetcher?: FetcherConfig;
  /** Block tracker window size (default: 128). */
  reorgWindowSize?: number;
}

export interface OrchestratorConfig {
  chains: ChainConfig[];
  /** Callback invoked with decoded events after each batch. */
  onEvents: (chainId: string, events: TeleporterEvent[]) => void | Promise<void>;
  /** Callback invoked when a reorg is detected. */
  onReorg?: (chainId: string, depth: number, invalidatedHashes: string[]) => void | Promise<void>;
  /** Interval between live polling cycles in ms (default: 2000). */
  pollIntervalMs?: number;
  /** Batch size for backfill in blocks (default: 10_000). */
  backfillBatchSize?: number;
}

export interface ChainStatus {
  chainId: string;
  mode: ChainMode;
  lastBlock: bigint;
  error?: string;
}

export interface Orchestrator {
  /** Start ingestion for all configured chains. Returns when all chains settle. */
  start(): Promise<void>;
  /** Graceful shutdown — stops all chains. */
  stop(): Promise<void>;
  /** Get status of all chain pollers. */
  status(): ChainStatus[];
}

// ---------------------------------------------------------------------------
// Per-chain state
// ---------------------------------------------------------------------------

interface ChainState {
  config: ChainConfig;
  mode: ChainMode;
  lastBlock: bigint;
  blockTracker: BlockTracker;
  error?: string;
  abortController: AbortController;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createOrchestrator(
  db: Database,
  clients: Map<string, RpcClient>,
  config: OrchestratorConfig,
): Orchestrator {
  const chains = new Map<string, ChainState>();
  const pollInterval = config.pollIntervalMs ?? 2000;
  const backfillBatch = BigInt(config.backfillBatchSize ?? 10_000);
  let runningPromise: Promise<void> | undefined;

  // Initialize chain states
  for (const chainCfg of config.chains) {
    chains.set(chainCfg.chainId, {
      config: chainCfg,
      mode: "stopped",
      lastBlock: 0n,
      blockTracker: new BlockTracker({ windowSize: chainCfg.reorgWindowSize ?? 128 }),
      abortController: new AbortController(),
    });
  }

  async function runChain(state: ChainState): Promise<void> {
    const client = clients.get(state.config.chainId);
    if (!client) {
      state.mode = "error";
      state.error = `No RPC client for chain ${state.config.chainId}`;
      return;
    }

    // Load checkpoint
    const cp = getCheckpoint(db, state.config.chainId, state.config.contractAddress);
    if (cp) {
      state.lastBlock = BigInt(cp.lastBlock);
    } else if (state.config.startBlock !== undefined) {
      state.lastBlock = state.config.startBlock;
    }

    // Backfill phase
    state.mode = "backfill";
    try {
      const tipBlock = await client.getBlockNumber();
      while (state.lastBlock < tipBlock && !state.abortController.signal.aborted) {
        const from = state.lastBlock + 1n;
        const to = from + backfillBatch - 1n < tipBlock ? from + backfillBatch - 1n : tipBlock;

        const result = await fetchTeleporterEvents(client, from, to, state.config.fetcher);

        if (result.events.length > 0) {
          await config.onEvents(state.config.chainId, result.events);
        }

        state.lastBlock = to;
        saveCheckpoint(db, state);
      }
    } catch (err) {
      if (state.abortController.signal.aborted) return;
      state.mode = "error";
      state.error = String(err);
      return;
    }

    if (state.abortController.signal.aborted) return;

    // Live phase
    state.mode = "live";
    while (!state.abortController.signal.aborted) {
      try {
        const tipBlock = await client.getBlockNumber();
        if (tipBlock > state.lastBlock) {
          // Check for reorgs by getting the header of the next block
          const nextBlock = state.lastBlock + 1n;
          const header = await client.getBlockHeader(nextBlock);
          const reorg = state.blockTracker.push(header);

          if (reorg) {
            // Rewind checkpoint
            state.lastBlock = reorg.forkBlock;
            saveCheckpoint(db, state);
            await config.onReorg?.(state.config.chainId, reorg.depth, reorg.invalidatedHashes);
            continue;
          }

          const result = await fetchTeleporterEvents(
            client,
            nextBlock,
            tipBlock,
            state.config.fetcher,
          );

          if (result.events.length > 0) {
            await config.onEvents(state.config.chainId, result.events);
          }

          // Push remaining headers
          for (let b = nextBlock + 1n; b <= tipBlock; b++) {
            const h = await client.getBlockHeader(b);
            state.blockTracker.push(h);
          }

          state.lastBlock = tipBlock;
          saveCheckpoint(db, state);
        }

        await sleep(pollInterval, state.abortController.signal);
      } catch (err) {
        if (state.abortController.signal.aborted) return;
        state.mode = "error";
        state.error = String(err);
        return;
      }
    }
  }

  function saveCheckpoint(db: Database, state: ChainState): void {
    upsertCheckpoint(db, {
      chainId: state.config.chainId,
      contractAddress: state.config.contractAddress,
      lastBlock: Number(state.lastBlock),
      blockHash: state.blockTracker.getHash(state.lastBlock) ?? "",
    });
  }

  return {
    async start(): Promise<void> {
      const promises: Promise<void>[] = [];
      for (const state of chains.values()) {
        state.abortController = new AbortController();
        promises.push(runChain(state));
      }
      runningPromise = Promise.allSettled(promises).then(() => {});
    },

    async stop(): Promise<void> {
      for (const state of chains.values()) {
        state.abortController.abort();
      }
      // Wait for all chains to finish
      if (runningPromise) {
        await runningPromise;
        runningPromise = undefined;
      }
      // Set stopped for chains that aren't in error
      for (const state of chains.values()) {
        if (state.mode !== "error") {
          state.mode = "stopped";
        }
      }
    },

    status(): ChainStatus[] {
      return Array.from(chains.values()).map((s) => ({
        chainId: s.config.chainId,
        mode: s.mode,
        lastBlock: s.lastBlock,
        error: s.error,
      }));
    },
  };
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}
