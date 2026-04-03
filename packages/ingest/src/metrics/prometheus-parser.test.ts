import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parsePrometheusText } from "./prometheus-parser.js";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("parsePrometheusText", () => {
  it("parses simple counter line", () => {
    const samples = parsePrometheusText("http_requests_total 1027");
    expect(samples).toHaveLength(1);
    expect(samples[0]!.name).toBe("http_requests_total");
    expect(samples[0]!.value).toBe(1027);
    expect(samples[0]!.labels).toEqual({});
  });

  it("parses gauge with labels", () => {
    const samples = parsePrometheusText('node_cpu_seconds_total{cpu="0",mode="idle"} 12345.67');
    expect(samples).toHaveLength(1);
    expect(samples[0]!.name).toBe("node_cpu_seconds_total");
    expect(samples[0]!.value).toBe(12345.67);
    expect(samples[0]!.labels).toEqual({ cpu: "0", mode: "idle" });
  });

  it("parses multi-label metric", () => {
    const samples = parsePrometheusText(
      'successful_relay_message_count{source_chain_id="chain-a",destination_chain_id="chain-b"} 42',
    );
    expect(samples).toHaveLength(1);
    expect(samples[0]!.labels).toEqual({
      source_chain_id: "chain-a",
      destination_chain_id: "chain-b",
    });
    expect(samples[0]!.value).toBe(42);
  });

  it("skips HELP and TYPE comment lines", () => {
    const text = [
      "# HELP http_requests_total The total number of HTTP requests.",
      "# TYPE http_requests_total counter",
      "http_requests_total 1027",
    ].join("\n");

    const samples = parsePrometheusText(text);
    expect(samples).toHaveLength(1);
    expect(samples[0]!.value).toBe(1027);
  });

  it("handles empty input", () => {
    expect(parsePrometheusText("")).toEqual([]);
    expect(parsePrometheusText("\n\n")).toEqual([]);
  });

  it("handles malformed lines gracefully (skip, don't throw)", () => {
    const text = ["valid_metric 42", "no_value_here", "{orphan_labels} 99", "another_valid 7"].join(
      "\n",
    );

    const samples = parsePrometheusText(text);
    expect(samples).toHaveLength(2);
    expect(samples[0]!.name).toBe("valid_metric");
    expect(samples[1]!.name).toBe("another_valid");
  });

  it("parses histogram _bucket, _sum, _count suffixes", () => {
    const text = [
      "# TYPE http_duration histogram",
      'http_duration_bucket{le="0.1"} 24054',
      'http_duration_bucket{le="0.5"} 33444',
      'http_duration_bucket{le="+Inf"} 144320',
      "http_duration_sum 53423",
      "http_duration_count 144320",
    ].join("\n");

    const samples = parsePrometheusText(text);
    expect(samples).toHaveLength(5);
    expect(samples[0]!.name).toBe("http_duration_bucket");
    expect(samples[0]!.labels).toEqual({ le: "0.1" });
    expect(samples[3]!.name).toBe("http_duration_sum");
    expect(samples[4]!.name).toBe("http_duration_count");
  });

  it("parses metric with timestamp", () => {
    const samples = parsePrometheusText("http_requests_total 1027 1395066363000");
    expect(samples).toHaveLength(1);
    expect(samples[0]!.value).toBe(1027);
    expect(samples[0]!.timestamp).toBe(1395066363000);
  });

  it("handles scientific notation values", () => {
    const samples = parsePrometheusText("go_gc_duration_seconds_sum 1.7838e+06");
    expect(samples).toHaveLength(1);
    expect(samples[0]!.value).toBe(1783800);
  });

  it("parses real relayer fixture (multi-metric block)", () => {
    const fixture = readFileSync(
      resolve(import.meta.dirname, "./__fixtures__/relayer-metrics.txt"),
      "utf-8",
    );
    const samples = parsePrometheusText(fixture);

    // Count expected metric lines (not comments or empty lines)
    expect(samples.length).toBeGreaterThanOrEqual(10);

    // Verify specific metrics
    const successMetrics = samples.filter((s) => s.name === "successful_relay_message_count");
    expect(successMetrics).toHaveLength(2);
    expect(successMetrics.find((s) => s.labels.source_chain_id === "chain-a")?.value).toBe(42);

    const latency = samples.find((s) => s.name === "create_signed_message_latency_ms");
    expect(latency).toBeDefined();
    expect(latency!.value).toBe(1250);
  });
});
