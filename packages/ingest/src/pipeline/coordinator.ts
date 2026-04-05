/**
 * Pipeline coordinator — wires orchestrator → normalizer → correlator → storage.
 *
 * The coordinator is the glue layer: it receives raw TeleporterEvents from the
 * orchestrator's onEvents callback, normalizes them, correlates into traces,
 * and persists via async upsertTrace.
 */

import type { DatabaseAdapter } from "@warplane/storage";
import { getTracesByMessageIds, upsertTrace } from "@warplane/storage";
import type { TeleporterEvent } from "../rpc/decoder.js";
import { normalize } from "./normalizer.js";
import { createCorrelator, type Correlator } from "./correlator.js";
import type { NormalizedEvent, PipelineStats, ChainRegistry } from "./types.js";
import type { AlertEvaluator } from "../alerts/alert-evaluator.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface PipelineConfig {
  /** Number of trace upserts to batch before auto-flushing (default: 50). */
  writeBatchSize?: number;
  /** Max time (ms) between automatic flushes for pending traces (default: 1_000). */
  flushIntervalMs?: number;
  /** Max number of trace upserts to run concurrently during flush (default: 8). */
  flushConcurrency?: number;
  /** Optional alert evaluator — when provided, state changes trigger alert evaluation. */
  alertEvaluator?: AlertEvaluator;
  /** Optional configured chains for canonical blockchain ID resolution. */
  chainRegistry?: ChainRegistry;
}

// ---------------------------------------------------------------------------
// Pipeline interface
// ---------------------------------------------------------------------------

export interface Pipeline {
  /** Process a batch of events from a chain. */
  handleEvents(chainId: string, events: TeleporterEvent[]): Promise<void>;
  /** Inject pre-normalized off-chain events (bypasses normalizer). */
  injectEvents(events: NormalizedEvent[]): void;
  /** Flush all pending trace writes to the database. */
  flush(): Promise<void>;
  /** Get pipeline statistics. */
  stats(): PipelineStats;
  /** Flush and prevent further processing. */
  stop(): void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createPipeline(db: DatabaseAdapter, config?: PipelineConfig): Pipeline {
  const writeBatchSize = config?.writeBatchSize ?? 50;
  const flushIntervalMs = config?.flushIntervalMs ?? 1_000;
  const flushConcurrency = Math.max(1, config?.flushConcurrency ?? 8);
  const alertEvaluator = config?.alertEvaluator;
  const correlator: Correlator = createCorrelator(config?.chainRegistry);
  let stopped = false;
  let pendingFlush = new Set<string>();
  let flushTimer: ReturnType<typeof setInterval> | undefined;

  const pipelineStats: PipelineStats = {
    eventsReceived: 0,
    eventsNormalized: 0,
    eventsDropped: 0,
    tracesCreated: 0,
    tracesUpdated: 0,
  };

  // Start a periodic flush timer on first event to ensure pending traces
  // are persisted even when batch size is not reached (e.g., sparse live traffic).
  function ensureFlushTimer(): void {
    if (flushTimer || stopped) return;
    flushTimer = setInterval(() => {
      if (pendingFlush.size > 0) {
        flush().catch(() => {
          /* periodic flush errors handled at higher level */
        });
      }
    }, flushIntervalMs);
    // Unref so the timer doesn't keep the process alive during shutdown.
    if (typeof flushTimer === "object" && "unref" in flushTimer) {
      flushTimer.unref();
    }
  }

  async function handleEvents(_chainId: string, events: TeleporterEvent[]): Promise<void> {
    if (stopped) return;
    ensureFlushTimer();

    const normalizedEvents: NormalizedEvent[] = [];
    const messageIdsToHydrate = new Set<string>();

    for (const event of events) {
      pipelineStats.eventsReceived++;

      const normalized = normalize(event, _chainId);
      if (!normalized) {
        pipelineStats.eventsDropped++;
        continue;
      }
      pipelineStats.eventsNormalized++;
      normalizedEvents.push(normalized);
      if (correlator.getMessageState(normalized.messageId) === null) {
        messageIdsToHydrate.add(normalized.messageId);
      }
    }

    if (messageIdsToHydrate.size > 0) {
      const persistedTraces = await getTracesByMessageIds(db, [...messageIdsToHydrate]);
      for (const trace of persistedTraces.values()) {
        correlator.seedTrace(trace);
      }
    }

    for (const normalized of normalizedEvents) {
      const result = correlator.processEvent(normalized);
      pendingFlush.add(result.messageId);

      if (result.isNew) {
        pipelineStats.tracesCreated++;
      } else if (result.isStateChange) {
        pipelineStats.tracesUpdated++;
      }

      if (result.isStateChange && alertEvaluator) {
        try {
          await alertEvaluator.evaluate(result);
        } catch {
          // Alert evaluation failures must not disrupt pipeline processing.
          // The event has already been correlated and will be persisted.
        }
      }
    }

    if (pendingFlush.size >= writeBatchSize) {
      await flush();
    }
  }

  function injectEvents(events: NormalizedEvent[]): void {
    if (stopped) return;

    for (const event of events) {
      pipelineStats.eventsReceived++;
      pipelineStats.eventsNormalized++;

      const result = correlator.processEvent(event);
      pendingFlush.add(result.messageId);

      if (result.isNew) {
        pipelineStats.tracesCreated++;
      } else if (result.isStateChange) {
        pipelineStats.tracesUpdated++;
      }
    }

    // Note: auto-flush is async but injectEvents is sync for backward compat.
    // If needed, callers should call flush() explicitly.
    if (pendingFlush.size >= writeBatchSize) {
      flush().catch(() => {
        /* pipeline error handling at higher level */
      });
    }
  }

  async function flush(): Promise<void> {
    const messageIds = Array.from(pendingFlush);
    if (messageIds.length === 0) return;

    pendingFlush = new Set();

    try {
      for (let i = 0; i < messageIds.length; i += flushConcurrency) {
        const batch = messageIds.slice(i, i + flushConcurrency);
        await Promise.all(
          batch.map(async (messageId) => {
            const trace = correlator.getTrace(messageId);
            if (trace) {
              await upsertTrace(db, trace);
            }
          }),
        );
      }
    } catch (error) {
      for (const messageId of messageIds) {
        pendingFlush.add(messageId);
      }
      throw error;
    }
  }

  function stats(): PipelineStats {
    return { ...pipelineStats };
  }

  function stop(): void {
    if (flushTimer) {
      clearInterval(flushTimer);
      flushTimer = undefined;
    }
    flush().catch(() => {
      /* best-effort flush on stop */
    });
    stopped = true;
  }

  return { handleEvents, injectEvents, flush, stats, stop };
}
