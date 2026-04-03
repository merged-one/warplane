import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createPrometheusScraper } from "./prometheus-scraper.js";

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------

const relayerFixture = readFileSync(
  resolve(import.meta.dirname, "./__fixtures__/relayer-metrics.txt"),
  "utf-8",
);

function mockFetchSuccess(body: string) {
  return vi.fn().mockResolvedValue({
    ok: true,
    text: () => Promise.resolve(body),
  });
}

function mockFetchFailure() {
  return vi.fn().mockRejectedValue(new Error("connection refused"));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PrometheusScraper", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("scrapeOnce() fetches and parses endpoint", async () => {
    globalThis.fetch = mockFetchSuccess(relayerFixture) as unknown as typeof fetch;

    const scraper = createPrometheusScraper({ endpoint: "http://localhost:9090/metrics" });
    const samples = await scraper.scrapeOnce();

    expect(samples.length).toBeGreaterThanOrEqual(10);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("getMetric() returns latest sample by name", async () => {
    globalThis.fetch = mockFetchSuccess(relayerFixture) as unknown as typeof fetch;

    const scraper = createPrometheusScraper({ endpoint: "http://localhost:9090/metrics" });
    await scraper.scrapeOnce();

    const sample = scraper.getMetric("create_signed_message_latency_ms");
    expect(sample).not.toBeNull();
    expect(sample!.value).toBe(1250);
  });

  it("getMetric() with label filter matches correctly", async () => {
    globalThis.fetch = mockFetchSuccess(relayerFixture) as unknown as typeof fetch;

    const scraper = createPrometheusScraper({ endpoint: "http://localhost:9090/metrics" });
    await scraper.scrapeOnce();

    const sample = scraper.getMetric("successful_relay_message_count", {
      source_chain_id: "chain-a",
    });
    expect(sample).not.toBeNull();
    expect(sample!.value).toBe(42);

    const noMatch = scraper.getMetric("successful_relay_message_count", {
      source_chain_id: "nonexistent",
    });
    expect(noMatch).toBeNull();
  });

  it("getMetricFamily() returns all samples for a metric name", async () => {
    globalThis.fetch = mockFetchSuccess(relayerFixture) as unknown as typeof fetch;

    const scraper = createPrometheusScraper({ endpoint: "http://localhost:9090/metrics" });
    await scraper.scrapeOnce();

    const family = scraper.getMetricFamily("successful_relay_message_count");
    expect(family).toHaveLength(2);
  });

  it("getCounterDelta() computes difference between scrapes", async () => {
    const firstScrape = 'my_counter{chain="a"} 10';
    const secondScrape = 'my_counter{chain="a"} 15';

    globalThis.fetch = mockFetchSuccess(firstScrape) as unknown as typeof fetch;
    const scraper = createPrometheusScraper({ endpoint: "http://localhost:9090/metrics" });
    await scraper.scrapeOnce();

    globalThis.fetch = mockFetchSuccess(secondScrape) as unknown as typeof fetch;
    await scraper.scrapeOnce();

    const delta = scraper.getCounterDelta("my_counter");
    expect(delta).toBe(5);
  });

  it("getCounterDelta() returns 0 on first scrape", async () => {
    globalThis.fetch = mockFetchSuccess("my_counter 10") as unknown as typeof fetch;

    const scraper = createPrometheusScraper({ endpoint: "http://localhost:9090/metrics" });
    await scraper.scrapeOnce();

    expect(scraper.getCounterDelta("my_counter")).toBe(0);
  });

  it("counter reset detection (new < old → delta = new value)", async () => {
    globalThis.fetch = mockFetchSuccess("my_counter 100") as unknown as typeof fetch;
    const scraper = createPrometheusScraper({ endpoint: "http://localhost:9090/metrics" });
    await scraper.scrapeOnce();

    // Counter resets to 5 (e.g., process restart)
    globalThis.fetch = mockFetchSuccess("my_counter 5") as unknown as typeof fetch;
    await scraper.scrapeOnce();

    expect(scraper.getCounterDelta("my_counter")).toBe(5);
  });

  it("onChange() fires callback on value change", async () => {
    const cb = vi.fn();
    globalThis.fetch = mockFetchSuccess("my_gauge 10") as unknown as typeof fetch;

    const scraper = createPrometheusScraper({ endpoint: "http://localhost:9090/metrics" });
    scraper.onChange("my_gauge", cb);
    await scraper.scrapeOnce();

    // First scrape — no previous value, so it fires
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(expect.objectContaining({ value: 10 }));

    // Same value — should NOT fire
    cb.mockClear();
    await scraper.scrapeOnce();
    expect(cb).not.toHaveBeenCalled();

    // Value changes — should fire
    globalThis.fetch = mockFetchSuccess("my_gauge 20") as unknown as typeof fetch;
    await scraper.scrapeOnce();
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(expect.objectContaining({ value: 20 }));
  });

  it("graceful degradation: fetch failure → isHealthy() false, last values retained", async () => {
    globalThis.fetch = mockFetchSuccess(relayerFixture) as unknown as typeof fetch;
    const scraper = createPrometheusScraper({ endpoint: "http://localhost:9090/metrics" });
    await scraper.scrapeOnce();

    expect(scraper.isHealthy()).toBe(true);
    const latency = scraper.getMetric("create_signed_message_latency_ms");
    expect(latency).not.toBeNull();

    // Now fetch fails
    globalThis.fetch = mockFetchFailure() as unknown as typeof fetch;
    await scraper.scrapeOnce();

    expect(scraper.isHealthy()).toBe(false);
    // Last values are retained
    const retained = scraper.getMetric("create_signed_message_latency_ms");
    expect(retained).not.toBeNull();
    expect(retained!.value).toBe(1250);
  });

  it("stop() prevents further scrapes", async () => {
    globalThis.fetch = mockFetchSuccess("my_counter 1") as unknown as typeof fetch;
    const scraper = createPrometheusScraper({
      endpoint: "http://localhost:9090/metrics",
      scrapeIntervalMs: 50,
    });

    scraper.start();
    scraper.stop();

    // Fetch may have been called once by start(), but no more after stop
    const callCount = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length;
    await new Promise((r) => setTimeout(r, 150));
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callCount);
  });
});
