import { describe, it, expect, vi } from "vitest";
import { createSigAggMetricsHandler } from "./sigagg-metrics.js";
import type { PrometheusScraper, MetricSample } from "./types.js";

// ---------------------------------------------------------------------------
// Mock scraper factory
// ---------------------------------------------------------------------------

function createMockScraper(
  opts: {
    metrics?: Map<string, MetricSample[]>;
    deltas?: Map<string, number>;
  } = {},
): PrometheusScraper {
  const metrics = opts.metrics ?? new Map();
  const deltas = opts.deltas ?? new Map();

  return {
    start: vi.fn(),
    stop: vi.fn(),
    scrapeOnce: vi.fn().mockResolvedValue([]),
    getMetric: vi.fn((name: string) => {
      const family = metrics.get(name);
      return family?.[0] ?? null;
    }),
    getMetricFamily: vi.fn((name: string) => metrics.get(name) ?? []),
    getCounterDelta: vi.fn((name: string) => deltas.get(name) ?? 0),
    onChange: vi.fn(() => vi.fn()),
    isHealthy: vi.fn().mockReturnValue(true),
  };
}

function ms(name: string, value: number, labels: Record<string, string> = {}): MetricSample {
  return { name, value, labels, timestamp: Date.now() };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SigAggMetricsHandler", () => {
  it("generates signatures_aggregated events from request count delta", () => {
    const handler = createSigAggMetricsHandler();
    const scraper = createMockScraper({
      metrics: new Map([["agg_sigs_latency_ms", [ms("agg_sigs_latency_ms", 2500)]]]),
      deltas: new Map([["agg_sigs_req_count", 3]]),
    });

    const result = handler.process(scraper);
    const sigEvents = result.events.filter((e) => e.kind === "signatures_aggregated");
    expect(sigEvents).toHaveLength(3);
  });

  it("sets aggregation latency in event details", () => {
    const handler = createSigAggMetricsHandler();
    const scraper = createMockScraper({
      metrics: new Map([["agg_sigs_latency_ms", [ms("agg_sigs_latency_ms", 1500)]]]),
      deltas: new Map([["agg_sigs_req_count", 1]]),
    });

    const result = handler.process(scraper);
    expect(result.events[0]!.details.aggregationLatencyMs).toBe(1500);
    expect(result.events[0]!.source).toBe("off-chain");
  });

  it("no events when delta is 0", () => {
    const handler = createSigAggMetricsHandler();
    const scraper = createMockScraper({
      deltas: new Map([["agg_sigs_req_count", 0]]),
    });

    const result = handler.process(scraper);
    expect(result.events).toHaveLength(0);
  });

  it("health: healthy when stake high and latency low", () => {
    const handler = createSigAggMetricsHandler();
    const scraper = createMockScraper({
      metrics: new Map([
        ["agg_sigs_latency_ms", [ms("agg_sigs_latency_ms", 2000)]],
        [
          "connected_stake_weight_percentage",
          [ms("connected_stake_weight_percentage", 90, { subnet_id: "subnet-a" })],
        ],
        ["signature_cache_hits", [ms("signature_cache_hits", 800)]],
        ["signature_cache_misses", [ms("signature_cache_misses", 200)]],
      ]),
    });

    const result = handler.process(scraper);
    expect(result.health.status).toBe("healthy");
    expect(result.health.aggregationLatencyMs).toBe(2000);
  });

  it("health: degraded when stake 67-80%", () => {
    const handler = createSigAggMetricsHandler();
    const scraper = createMockScraper({
      metrics: new Map([
        ["agg_sigs_latency_ms", [ms("agg_sigs_latency_ms", 2000)]],
        [
          "connected_stake_weight_percentage",
          [ms("connected_stake_weight_percentage", 75, { subnet_id: "subnet-a" })],
        ],
      ]),
    });

    const result = handler.process(scraper);
    expect(result.health.status).toBe("degraded");
  });

  it("health: unhealthy when stake < 67%", () => {
    const handler = createSigAggMetricsHandler();
    const scraper = createMockScraper({
      metrics: new Map([
        ["agg_sigs_latency_ms", [ms("agg_sigs_latency_ms", 2000)]],
        [
          "connected_stake_weight_percentage",
          [ms("connected_stake_weight_percentage", 60, { subnet_id: "subnet-a" })],
        ],
      ]),
    });

    const result = handler.process(scraper);
    expect(result.health.status).toBe("unhealthy");
  });

  it("health: unhealthy when latency > 15000ms", () => {
    const handler = createSigAggMetricsHandler();
    const scraper = createMockScraper({
      metrics: new Map([
        ["agg_sigs_latency_ms", [ms("agg_sigs_latency_ms", 20000)]],
        [
          "connected_stake_weight_percentage",
          [ms("connected_stake_weight_percentage", 90, { subnet_id: "subnet-a" })],
        ],
      ]),
    });

    const result = handler.process(scraper);
    expect(result.health.status).toBe("unhealthy");
  });

  it("computes cache hit rate correctly", () => {
    const handler = createSigAggMetricsHandler();
    const scraper = createMockScraper({
      metrics: new Map([
        ["agg_sigs_latency_ms", [ms("agg_sigs_latency_ms", 1000)]],
        [
          "connected_stake_weight_percentage",
          [ms("connected_stake_weight_percentage", 90, { subnet_id: "subnet-a" })],
        ],
        ["signature_cache_hits", [ms("signature_cache_hits", 800)]],
        ["signature_cache_misses", [ms("signature_cache_misses", 200)]],
      ]),
    });

    const result = handler.process(scraper);
    expect(result.health.cacheHitRate).toBe(80); // 800/(800+200)
  });

  it("tracks validator timeout rate", () => {
    const handler = createSigAggMetricsHandler();
    const scraper = createMockScraper({
      metrics: new Map([
        ["agg_sigs_latency_ms", [ms("agg_sigs_latency_ms", 2000)]],
        [
          "connected_stake_weight_percentage",
          [ms("connected_stake_weight_percentage", 90, { subnet_id: "subnet-a" })],
        ],
      ]),
      deltas: new Map([["validator_timeouts", 5]]),
    });

    const result = handler.process(scraper);
    expect(result.health.validatorTimeoutRate).toBe(5);
    // Timeouts cause degraded status
    expect(result.health.status).toBe("degraded");
  });

  it("handles missing metrics gracefully", () => {
    const handler = createSigAggMetricsHandler();
    const scraper = createMockScraper(); // No metrics

    const result = handler.process(scraper);
    expect(result.events).toHaveLength(0);
    expect(result.health.status).toBe("healthy");
    expect(result.health.aggregationLatencyMs).toBe(0);
    expect(result.health.cacheHitRate).toBe(0);
  });
});
