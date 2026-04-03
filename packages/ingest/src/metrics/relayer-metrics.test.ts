import { describe, it, expect, vi } from "vitest";
import { createRelayerMetricsHandler } from "./relayer-metrics.js";
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

  function sampleKey(name: string, labels: Record<string, string>): string {
    const sorted = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(",");
    return `${name}{${sorted}}`;
  }

  return {
    start: vi.fn(),
    stop: vi.fn(),
    scrapeOnce: vi.fn().mockResolvedValue([]),
    getMetric: vi.fn((name: string, labels?: Record<string, string>) => {
      const family = metrics.get(name);
      if (!family) return null;
      if (!labels) return family[0] ?? null;
      return (
        family.find((s: MetricSample) =>
          Object.entries(labels).every(([k, v]) => s.labels[k] === v),
        ) ?? null
      );
    }),
    getMetricFamily: vi.fn((name: string) => metrics.get(name) ?? []),
    getCounterDelta: vi.fn((name: string, labels?: Record<string, string>) => {
      if (labels) {
        return deltas.get(sampleKey(name, labels)) ?? 0;
      }
      // Sum all deltas for this metric name
      let total = 0;
      for (const [key, val] of deltas) {
        if (key.startsWith(`${name}{`)) total += val;
      }
      return total;
    }),
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

describe("RelayerMetricsHandler", () => {
  it("generates relay_submitted events from counter delta", () => {
    const handler = createRelayerMetricsHandler({ relayerId: "relayer-1" });
    const scraper = createMockScraper({
      metrics: new Map([
        [
          "successful_relay_message_count",
          [
            ms("successful_relay_message_count", 42, {
              source_chain_id: "chain-a",
              destination_chain_id: "chain-b",
            }),
          ],
        ],
      ]),
      deltas: new Map([
        ["successful_relay_message_count{destination_chain_id=chain-b,source_chain_id=chain-a}", 2],
      ]),
    });

    const result = handler.process(scraper);
    const relayEvents = result.events.filter((e) => e.kind === "relay_submitted");
    expect(relayEvents).toHaveLength(2);
  });

  it("generates warp_message_extracted alongside relay_submitted", () => {
    const handler = createRelayerMetricsHandler({ relayerId: "relayer-1" });
    const scraper = createMockScraper({
      metrics: new Map([
        [
          "successful_relay_message_count",
          [
            ms("successful_relay_message_count", 10, {
              source_chain_id: "chain-a",
              destination_chain_id: "chain-b",
            }),
          ],
        ],
      ]),
      deltas: new Map([
        ["successful_relay_message_count{destination_chain_id=chain-b,source_chain_id=chain-a}", 1],
      ]),
    });

    const result = handler.process(scraper);
    const warpEvents = result.events.filter((e) => e.kind === "warp_message_extracted");
    const relayEvents = result.events.filter((e) => e.kind === "relay_submitted");
    expect(warpEvents).toHaveLength(1);
    expect(relayEvents).toHaveLength(1);
  });

  it("sets correct chain pair on generated events", () => {
    const handler = createRelayerMetricsHandler({ relayerId: "relayer-1" });
    const scraper = createMockScraper({
      metrics: new Map([
        [
          "successful_relay_message_count",
          [
            ms("successful_relay_message_count", 5, {
              source_chain_id: "src-chain",
              destination_chain_id: "dst-chain",
            }),
          ],
        ],
      ]),
      deltas: new Map([
        [
          "successful_relay_message_count{destination_chain_id=dst-chain,source_chain_id=src-chain}",
          1,
        ],
      ]),
    });

    const result = handler.process(scraper);
    const warp = result.events.find((e) => e.kind === "warp_message_extracted")!;
    const relay = result.events.find((e) => e.kind === "relay_submitted")!;

    expect(warp.chain).toBe("src-chain");
    expect(warp.details.sourceChainId).toBe("src-chain");
    expect(relay.chain).toBe("dst-chain");
    expect(relay.details.destinationChainId).toBe("dst-chain");
  });

  it("no events when delta is 0", () => {
    const handler = createRelayerMetricsHandler({ relayerId: "relayer-1" });
    const scraper = createMockScraper({
      metrics: new Map([
        [
          "successful_relay_message_count",
          [
            ms("successful_relay_message_count", 42, {
              source_chain_id: "chain-a",
              destination_chain_id: "chain-b",
            }),
          ],
        ],
      ]),
      deltas: new Map([
        ["successful_relay_message_count{destination_chain_id=chain-b,source_chain_id=chain-a}", 0],
      ]),
    });

    const result = handler.process(scraper);
    expect(result.events).toHaveLength(0);
  });

  it("health: healthy when all metrics in range", () => {
    const handler = createRelayerMetricsHandler({ relayerId: "relayer-1" });
    const scraper = createMockScraper({
      metrics: new Map([
        ["create_signed_message_latency_ms", [ms("create_signed_message_latency_ms", 500)]],
        [
          "checkpoint_pending_commits_heap_length",
          [ms("checkpoint_pending_commits_heap_length", 5)],
        ],
      ]),
    });

    const result = handler.process(scraper);
    expect(result.health.status).toBe("healthy");
    expect(result.health.successRate).toBe(100);
  });

  it("health: degraded on elevated latency", () => {
    const handler = createRelayerMetricsHandler({ relayerId: "relayer-1" });
    const scraper = createMockScraper({
      metrics: new Map([
        ["create_signed_message_latency_ms", [ms("create_signed_message_latency_ms", 7000)]],
        [
          "checkpoint_pending_commits_heap_length",
          [ms("checkpoint_pending_commits_heap_length", 5)],
        ],
      ]),
    });

    const result = handler.process(scraper);
    expect(result.health.status).toBe("degraded");
  });

  it("health: unhealthy on low success rate", () => {
    const handler = createRelayerMetricsHandler({ relayerId: "relayer-1" });
    const scraper = createMockScraper({
      metrics: new Map([
        [
          "successful_relay_message_count",
          [
            ms("successful_relay_message_count", 10, {
              source_chain_id: "a",
              destination_chain_id: "b",
            }),
          ],
        ],
        [
          "failed_relay_message_count",
          [
            ms("failed_relay_message_count", 90, {
              source_chain_id: "a",
              destination_chain_id: "b",
              failure_reason: "gas",
            }),
          ],
        ],
        ["create_signed_message_latency_ms", [ms("create_signed_message_latency_ms", 500)]],
        [
          "checkpoint_pending_commits_heap_length",
          [ms("checkpoint_pending_commits_heap_length", 5)],
        ],
      ]),
      deltas: new Map([
        ["successful_relay_message_count{destination_chain_id=b,source_chain_id=a}", 2],
        [
          "failed_relay_message_count{destination_chain_id=b,failure_reason=gas,source_chain_id=a}",
          8,
        ],
      ]),
    });

    const result = handler.process(scraper);
    expect(result.health.status).toBe("unhealthy");
    expect(result.health.successRate).toBe(20); // 2/(2+8) = 20%
  });

  it("tracks failure reasons from labels", () => {
    const handler = createRelayerMetricsHandler({ relayerId: "relayer-1" });
    const scraper = createMockScraper({
      metrics: new Map([
        [
          "failed_relay_message_count",
          [
            ms("failed_relay_message_count", 5, {
              source_chain_id: "a",
              destination_chain_id: "b",
              failure_reason: "insufficient_gas",
            }),
            ms("failed_relay_message_count", 2, {
              source_chain_id: "a",
              destination_chain_id: "b",
              failure_reason: "timeout",
            }),
          ],
        ],
        ["create_signed_message_latency_ms", [ms("create_signed_message_latency_ms", 500)]],
        [
          "checkpoint_pending_commits_heap_length",
          [ms("checkpoint_pending_commits_heap_length", 5)],
        ],
      ]),
      deltas: new Map([
        [
          "failed_relay_message_count{destination_chain_id=b,failure_reason=insufficient_gas,source_chain_id=a}",
          3,
        ],
        [
          "failed_relay_message_count{destination_chain_id=b,failure_reason=timeout,source_chain_id=a}",
          1,
        ],
      ]),
    });

    const result = handler.process(scraper);
    expect(result.health.topFailureReasons).toHaveLength(2);
    expect(result.health.topFailureReasons[0]!.reason).toBe("insufficient_gas");
    expect(result.health.topFailureReasons[0]!.count).toBe(3);
  });

  it("computes lag from checkpoint vs chain tip", () => {
    const handler = createRelayerMetricsHandler({
      relayerId: "relayer-1",
      chainTipProvider: (chainId) => {
        if (chainId === "chain-a") return 50100n;
        return undefined;
      },
    });

    const scraper = createMockScraper({
      metrics: new Map([
        [
          "checkpoint_committed_height",
          [ms("checkpoint_committed_height", 50000, { chain_id: "chain-a" })],
        ],
        ["create_signed_message_latency_ms", [ms("create_signed_message_latency_ms", 500)]],
        [
          "checkpoint_pending_commits_heap_length",
          [ms("checkpoint_pending_commits_heap_length", 5)],
        ],
      ]),
    });

    const result = handler.process(scraper);
    expect(result.health.lagBlocks).toBe(100);
  });

  it("handles missing metrics gracefully", () => {
    const handler = createRelayerMetricsHandler({ relayerId: "relayer-1" });
    const scraper = createMockScraper(); // No metrics at all

    const result = handler.process(scraper);
    expect(result.events).toHaveLength(0);
    expect(result.health.status).toBe("healthy");
    expect(result.health.latencyMs).toBe(0);
  });
});
