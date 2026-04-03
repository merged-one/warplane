/**
 * Shared types for Prometheus metrics integration.
 *
 * Covers metric samples, counter deltas, and health snapshots
 * for both the ICM Relayer and Signature Aggregator.
 */

import type { NormalizedEvent } from "../pipeline/types.js";

// ---------------------------------------------------------------------------
// Metric primitives
// ---------------------------------------------------------------------------

export interface MetricSample {
  name: string;
  labels: Record<string, string>;
  value: number;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Counter deltas (computed between scrapes)
// ---------------------------------------------------------------------------

export interface CounterDelta {
  sourceChainId: string;
  destinationChainId: string;
  delta: number;
}

export interface FailedRelayDelta extends CounterDelta {
  failureReason: string;
}

// ---------------------------------------------------------------------------
// Scraper config & interface
// ---------------------------------------------------------------------------

export interface ScraperConfig {
  /** Target endpoint (e.g., http://localhost:9090/metrics). */
  endpoint: string;
  /** Scrape interval in milliseconds (default: 10_000). */
  scrapeIntervalMs?: number;
  /** Request timeout in milliseconds (default: 5_000). */
  timeoutMs?: number;
  /** Labels to include in all metrics from this target. */
  staticLabels?: Record<string, string>;
}

export interface PrometheusScraper {
  start(): void;
  stop(): void;
  /** Manually trigger a single scrape (useful for testing). */
  scrapeOnce(): Promise<MetricSample[]>;
  /** Get latest value for a metric, optionally filtered by labels. */
  getMetric(name: string, labels?: Record<string, string>): MetricSample | null;
  /** Get all samples for a metric family. */
  getMetricFamily(name: string): MetricSample[];
  /** Get counter delta since last scrape, optionally filtered by labels. */
  getCounterDelta(name: string, labels?: Record<string, string>): number;
  /** Subscribe to metric value changes. Returns unsubscribe function. */
  onChange(name: string, callback: (sample: MetricSample) => void): () => void;
  /** Whether the last scrape succeeded. */
  isHealthy(): boolean;
}

// ---------------------------------------------------------------------------
// Health status
// ---------------------------------------------------------------------------

export type HealthStatus = "healthy" | "degraded" | "unhealthy";

// ---------------------------------------------------------------------------
// Relayer health & processing
// ---------------------------------------------------------------------------

export interface RelayerHealthSnapshot {
  relayerId: string;
  status: HealthStatus;
  successRate: number;
  latencyMs: number;
  lagBlocks: number;
  pendingMessages: number;
  topFailureReasons: Array<{ reason: string; count: number }>;
  lastUpdated: string;
}

export interface RelayerProcessResult {
  events: NormalizedEvent[];
  health: RelayerHealthSnapshot;
}

export interface RelayerMetricsHandler {
  process(scraper: PrometheusScraper): RelayerProcessResult;
}

export interface RelayerMetricsConfig {
  relayerId: string;
  chainTipProvider?: (chainId: string) => bigint | undefined;
}

// ---------------------------------------------------------------------------
// Sig-agg health & processing
// ---------------------------------------------------------------------------

export interface SigAggHealthSnapshot {
  status: HealthStatus;
  aggregationLatencyMs: number;
  connectedStakePercent: Record<string, number>;
  cacheHitRate: number;
  validatorTimeoutRate: number;
  topErrors: Array<{ type: string; count: number }>;
  lastUpdated: string;
}

export interface SigAggProcessResult {
  events: NormalizedEvent[];
  health: SigAggHealthSnapshot;
}

export interface SigAggMetricsHandler {
  process(scraper: PrometheusScraper): SigAggProcessResult;
}
