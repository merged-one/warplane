/**
 * Signature Aggregator metrics handler — interprets Sig-Agg Prometheus metrics
 * to generate off-chain events and health snapshots.
 *
 * Metrics scraped from port 8081:
 * - agg_sigs_latency_ms (gauge)
 * - agg_sigs_req_count (counter)
 * - app_request_count (counter)
 * - connected_stake_weight_percentage (gauge, per subnet)
 * - validator_timeouts (counter)
 * - failures_to_get_validator_set (counter)
 * - failures_to_connect_to_sufficient_stake (counter)
 * - failures_sending_to_node (counter)
 * - invalid_signature_responses (counter)
 * - signature_cache_hits / signature_cache_misses (counters)
 */

import type { NormalizedEvent } from "../pipeline/types.js";
import type {
  PrometheusScraper,
  SigAggMetricsHandler,
  SigAggProcessResult,
  SigAggHealthSnapshot,
  HealthStatus,
} from "./types.js";

// ---------------------------------------------------------------------------
// Metric names
// ---------------------------------------------------------------------------

const AGG_LATENCY = "agg_sigs_latency_ms";
const AGG_REQ_COUNT = "agg_sigs_req_count";
const STAKE_PERCENT = "connected_stake_weight_percentage";
const VALIDATOR_TIMEOUTS = "validator_timeouts";
const CACHE_HITS = "signature_cache_hits";
const CACHE_MISSES = "signature_cache_misses";

const ERROR_METRICS = [
  "failures_to_get_validator_set",
  "failures_to_connect_to_sufficient_stake",
  "failures_sending_to_node",
  "invalid_signature_responses",
] as const;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createSigAggMetricsHandler(): SigAggMetricsHandler {
  return {
    process(scraper: PrometheusScraper): SigAggProcessResult {
      const events = generateEvents(scraper);
      const health = computeHealth(scraper);
      return { events, health };
    },
  };
}

// ---------------------------------------------------------------------------
// Event generation
// ---------------------------------------------------------------------------

function generateEvents(scraper: PrometheusScraper): NormalizedEvent[] {
  const events: NormalizedEvent[] = [];
  const delta = scraper.getCounterDelta(AGG_REQ_COUNT);

  const latency = scraper.getMetric(AGG_LATENCY)?.value ?? 0;
  const stakePercent = getStakePercent(scraper);

  for (let i = 0; i < delta; i++) {
    const ts = new Date().toISOString();
    events.push({
      kind: "signatures_aggregated",
      messageId: `metrics:sigagg:${ts}:${i}`,
      timestamp: ts,
      blockNumber: 0,
      txHash: "",
      chain: "",
      source: "off-chain",
      details: {
        aggregationLatencyMs: latency,
        connectedStakePercent: stakePercent,
      },
    });
  }

  return events;
}

// ---------------------------------------------------------------------------
// Health computation
// ---------------------------------------------------------------------------

function computeHealth(scraper: PrometheusScraper): SigAggHealthSnapshot {
  const latency = scraper.getMetric(AGG_LATENCY)?.value ?? 0;
  const stakePercent = getStakePercent(scraper);
  const cacheHitRate = computeCacheHitRate(scraper);
  const timeoutRate = computeTimeoutRate(scraper);
  const topErrors = extractErrors(scraper);

  const minStake =
    Object.values(stakePercent).length > 0 ? Math.min(...Object.values(stakePercent)) : 100;

  const status = classifyHealth(minStake, latency, timeoutRate);

  return {
    status,
    aggregationLatencyMs: latency,
    connectedStakePercent: stakePercent,
    cacheHitRate,
    validatorTimeoutRate: timeoutRate,
    topErrors,
    lastUpdated: new Date().toISOString(),
  };
}

function classifyHealth(
  minStakePercent: number,
  latencyMs: number,
  timeoutRate: number,
): HealthStatus {
  if (minStakePercent < 67 || latencyMs > 15000) return "unhealthy";
  if (minStakePercent < 80 || latencyMs > 5000 || timeoutRate > 0) return "degraded";
  return "healthy";
}

function getStakePercent(scraper: PrometheusScraper): Record<string, number> {
  const family = scraper.getMetricFamily(STAKE_PERCENT);
  const result: Record<string, number> = {};
  for (const sample of family) {
    const subnet = sample.labels.subnet_id ?? "unknown";
    result[subnet] = sample.value;
  }
  return result;
}

function computeCacheHitRate(scraper: PrometheusScraper): number {
  const hits = scraper.getMetric(CACHE_HITS)?.value ?? 0;
  const misses = scraper.getMetric(CACHE_MISSES)?.value ?? 0;
  const total = hits + misses;
  return total > 0 ? (hits / total) * 100 : 0;
}

function computeTimeoutRate(scraper: PrometheusScraper): number {
  return scraper.getCounterDelta(VALIDATOR_TIMEOUTS);
}

function extractErrors(scraper: PrometheusScraper): Array<{ type: string; count: number }> {
  const errors: Array<{ type: string; count: number }> = [];

  for (const metric of ERROR_METRICS) {
    const delta = scraper.getCounterDelta(metric);
    if (delta > 0) {
      errors.push({ type: metric, count: delta });
    }
  }

  return errors.sort((a, b) => b.count - a.count);
}
