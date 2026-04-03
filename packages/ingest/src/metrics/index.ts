/**
 * Metrics module — Prometheus scraping, metric interpretation, and health snapshots.
 */

export { parsePrometheusText } from "./prometheus-parser.js";
export { createPrometheusScraper } from "./prometheus-scraper.js";
export { createRelayerMetricsHandler } from "./relayer-metrics.js";
export { createSigAggMetricsHandler } from "./sigagg-metrics.js";

export type {
  MetricSample,
  ScraperConfig,
  PrometheusScraper,
  HealthStatus,
  RelayerHealthSnapshot,
  SigAggHealthSnapshot,
  RelayerMetricsConfig,
  RelayerMetricsHandler,
  RelayerProcessResult,
  SigAggMetricsHandler,
  SigAggProcessResult,
} from "./types.js";
