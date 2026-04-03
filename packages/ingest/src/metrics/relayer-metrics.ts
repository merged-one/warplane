/**
 * Relayer metrics handler — interprets ICM Relayer Prometheus metrics to
 * generate off-chain events and health snapshots.
 *
 * Metrics scraped from port 9090:
 * - successful_relay_message_count (counter, chain-pair labels)
 * - failed_relay_message_count (counter, chain-pair + failure_reason labels)
 * - create_signed_message_latency_ms (gauge)
 * - checkpoint_committed_height (gauge, per chain)
 * - checkpoint_pending_commits_heap_length (gauge)
 * - p_chain_api_call_latency_ms (gauge)
 * - connects / disconnects (counters)
 */

import type { NormalizedEvent } from "../pipeline/types.js";
import type {
  PrometheusScraper,
  RelayerMetricsConfig,
  RelayerMetricsHandler,
  RelayerProcessResult,
  RelayerHealthSnapshot,
  HealthStatus,
} from "./types.js";

// ---------------------------------------------------------------------------
// Metric names
// ---------------------------------------------------------------------------

const SUCCESS_COUNT = "successful_relay_message_count";
const FAILED_COUNT = "failed_relay_message_count";
const LATENCY = "create_signed_message_latency_ms";
const CHECKPOINT_HEIGHT = "checkpoint_committed_height";
const PENDING_COMMITS = "checkpoint_pending_commits_heap_length";

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createRelayerMetricsHandler(config: RelayerMetricsConfig): RelayerMetricsHandler {
  return {
    process(scraper: PrometheusScraper): RelayerProcessResult {
      const events = generateEvents(scraper);
      const health = computeHealth(scraper, config);
      return { events, health };
    },
  };
}

// ---------------------------------------------------------------------------
// Event generation
// ---------------------------------------------------------------------------

function generateEvents(scraper: PrometheusScraper): NormalizedEvent[] {
  const events: NormalizedEvent[] = [];
  const successFamily = scraper.getMetricFamily(SUCCESS_COUNT);

  for (const sample of successFamily) {
    const srcChain = sample.labels.source_chain_id ?? "";
    const dstChain = sample.labels.destination_chain_id ?? "";
    if (!srcChain || !dstChain) continue;

    const delta = scraper.getCounterDelta(SUCCESS_COUNT, {
      source_chain_id: srcChain,
      destination_chain_id: dstChain,
    });

    for (let i = 0; i < delta; i++) {
      const ts = new Date().toISOString();

      // warp_message_extracted implies the relayer observed the Warp log
      events.push({
        kind: "warp_message_extracted",
        messageId: `metrics:${srcChain}:${dstChain}:${ts}:${i}:warp`,
        timestamp: ts,
        blockNumber: 0,
        txHash: "",
        chain: srcChain,
        source: "off-chain",
        details: { sourceChainId: srcChain, destinationChainId: dstChain },
      });

      // relay_submitted means the relayer submitted the delivery tx
      events.push({
        kind: "relay_submitted",
        messageId: `metrics:${srcChain}:${dstChain}:${ts}:${i}:relay`,
        timestamp: ts,
        blockNumber: 0,
        txHash: "",
        chain: dstChain,
        source: "off-chain",
        details: { sourceChainId: srcChain, destinationChainId: dstChain },
      });
    }
  }

  return events;
}

// ---------------------------------------------------------------------------
// Health computation
// ---------------------------------------------------------------------------

function computeHealth(
  scraper: PrometheusScraper,
  config: RelayerMetricsConfig,
): RelayerHealthSnapshot {
  const latency = scraper.getMetric(LATENCY)?.value ?? 0;
  const pending = scraper.getMetric(PENDING_COMMITS)?.value ?? 0;

  // Compute success rate from counter deltas
  const totalSuccess = sumCounterDelta(scraper, SUCCESS_COUNT);
  const totalFailed = sumCounterDelta(scraper, FAILED_COUNT);
  const total = totalSuccess + totalFailed;
  const successRate = total > 0 ? (totalSuccess / total) * 100 : 100;

  // Compute lag
  const lagBlocks = computeLag(scraper, config);

  // Failure reasons
  const failureReasons = extractFailureReasons(scraper);

  const status = classifyHealth(successRate, latency, pending);

  return {
    relayerId: config.relayerId,
    status,
    successRate,
    latencyMs: latency,
    lagBlocks,
    pendingMessages: pending,
    topFailureReasons: failureReasons,
    lastUpdated: new Date().toISOString(),
  };
}

function classifyHealth(successRate: number, latencyMs: number, pending: number): HealthStatus {
  if (successRate < 80 || latencyMs > 15000 || pending > 500) return "unhealthy";
  if (successRate < 95 || latencyMs > 5000 || pending > 100) return "degraded";
  return "healthy";
}

function sumCounterDelta(scraper: PrometheusScraper, metricName: string): number {
  const family = scraper.getMetricFamily(metricName);
  let total = 0;

  for (const sample of family) {
    total += scraper.getCounterDelta(metricName, sample.labels);
  }

  return total;
}

function computeLag(scraper: PrometheusScraper, config: RelayerMetricsConfig): number {
  if (!config.chainTipProvider) return 0;

  const checkpoints = scraper.getMetricFamily(CHECKPOINT_HEIGHT);
  let maxLag = 0;

  for (const cp of checkpoints) {
    const chainId = cp.labels.chain_id;
    if (!chainId) continue;

    const tip = config.chainTipProvider(chainId);
    if (tip !== undefined) {
      const lag = Number(tip) - cp.value;
      if (lag > maxLag) maxLag = lag;
    }
  }

  return maxLag;
}

function extractFailureReasons(
  scraper: PrometheusScraper,
): Array<{ reason: string; count: number }> {
  const family = scraper.getMetricFamily(FAILED_COUNT);
  const reasons = new Map<string, number>();

  for (const sample of family) {
    const reason = sample.labels.failure_reason;
    if (!reason) continue;

    const delta = scraper.getCounterDelta(FAILED_COUNT, sample.labels);
    if (delta > 0) {
      reasons.set(reason, (reasons.get(reason) ?? 0) + delta);
    }
  }

  return Array.from(reasons.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);
}
