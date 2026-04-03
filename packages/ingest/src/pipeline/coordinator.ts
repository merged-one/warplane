/**
 * Pipeline coordinator — wires orchestrator → normalizer → correlator → storage.
 *
 * The coordinator is the glue layer: it receives raw TeleporterEvents from the
 * orchestrator's onEvents callback, normalizes them, correlates into traces,
 * and persists to SQLite via upsertTrace.
 */

import type { Database } from "@warplane/storage";
import { upsertTrace } from "@warplane/storage";
import type { TeleporterEvent } from "../rpc/decoder.js";
import { normalize } from "./normalizer.js";
import { createCorrelator, type Correlator } from "./correlator.js";
import type { NormalizedEvent, PipelineStats } from "./types.js";
import type { AlertEvaluator } from "../alerts/alert-evaluator.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface PipelineConfig {
  /** Number of trace upserts to batch before auto-flushing (default: 50). */
  writeBatchSize?: number;
  /** Optional alert evaluator — when provided, state changes trigger alert evaluation. */
  alertEvaluator?: AlertEvaluator;
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
  flush(): void;
  /** Get pipeline statistics. */
  stats(): PipelineStats;
  /** Flush and prevent further processing. */
  stop(): void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createPipeline(db: Database, config?: PipelineConfig): Pipeline {
  const writeBatchSize = config?.writeBatchSize ?? 50;
  const alertEvaluator = config?.alertEvaluator;
  const correlator: Correlator = createCorrelator();
  let stopped = false;
  let pendingFlush = new Set<string>();

  const pipelineStats: PipelineStats = {
    eventsReceived: 0,
    eventsNormalized: 0,
    eventsDropped: 0,
    tracesCreated: 0,
    tracesUpdated: 0,
  };

  async function handleEvents(_chainId: string, events: TeleporterEvent[]): Promise<void> {
    if (stopped) return;

    for (const event of events) {
      pipelineStats.eventsReceived++;

      const normalized = normalize(event, _chainId);
      if (!normalized) {
        pipelineStats.eventsDropped++;
        continue;
      }
      pipelineStats.eventsNormalized++;

      const result = correlator.processEvent(normalized);
      pendingFlush.add(result.messageId);

      if (result.isNew) {
        pipelineStats.tracesCreated++;
      } else if (result.isStateChange) {
        pipelineStats.tracesUpdated++;
      }

      if (result.isStateChange && alertEvaluator) {
        await alertEvaluator.evaluate(result);
      }
    }

    if (pendingFlush.size >= writeBatchSize) {
      flush();
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

    if (pendingFlush.size >= writeBatchSize) {
      flush();
    }
  }

  function flush(): void {
    for (const messageId of pendingFlush) {
      const trace = correlator.getTrace(messageId);
      if (trace) {
        upsertTrace(db, trace);
      }
    }
    pendingFlush = new Set();
  }

  function stats(): PipelineStats {
    return { ...pipelineStats };
  }

  function stop(): void {
    flush();
    stopped = true;
  }

  return { handleEvents, injectEvents, flush, stats, stop };
}
