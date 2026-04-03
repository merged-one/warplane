/**
 * Prometheus scraper — periodically fetches and parses metrics from an HTTP endpoint.
 *
 * Features:
 * - Polling lifecycle with configurable interval
 * - Counter delta tracking between scrapes
 * - Graceful degradation on fetch failure
 * - Subscription-based change notifications
 */

import type { MetricSample, ScraperConfig, PrometheusScraper } from "./types.js";
import { parsePrometheusText } from "./prometheus-parser.js";

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createPrometheusScraper(config: ScraperConfig): PrometheusScraper {
  const scrapeInterval = config.scrapeIntervalMs ?? 10_000;
  const timeout = config.timeoutMs ?? 5_000;
  const staticLabels = config.staticLabels ?? {};

  // State
  let samples = new Map<string, MetricSample[]>();
  let previousCounterValues = new Map<string, number>();
  let currentCounterValues = new Map<string, number>();
  let healthy = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  let stopped = false;

  // Subscriptions
  const listeners = new Map<string, Set<(sample: MetricSample) => void>>();

  // ---------------------------------------------------------------------------
  // Core scrape
  // ---------------------------------------------------------------------------

  async function scrapeOnce(): Promise<MetricSample[]> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(config.endpoint, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        healthy = false;
        return [];
      }

      const text = await response.text();
      const parsed = parsePrometheusText(text);

      // Apply static labels
      for (const sample of parsed) {
        Object.assign(sample.labels, staticLabels);
      }

      // Update state
      const newSamples = new Map<string, MetricSample[]>();
      for (const sample of parsed) {
        const existing = newSamples.get(sample.name) ?? [];
        existing.push(sample);
        newSamples.set(sample.name, existing);
      }

      // Rotate counter tracking
      previousCounterValues = currentCounterValues;
      currentCounterValues = new Map<string, number>();
      for (const sample of parsed) {
        const key = sampleKey(sample.name, sample.labels);
        currentCounterValues.set(key, sample.value);
      }

      // Fire change notifications
      for (const sample of parsed) {
        const cbs = listeners.get(sample.name);
        if (cbs) {
          const prevKey = sampleKey(sample.name, sample.labels);
          const prevVal = previousCounterValues.get(prevKey);
          if (prevVal === undefined || prevVal !== sample.value) {
            for (const cb of cbs) cb(sample);
          }
        }
      }

      samples = newSamples;
      healthy = true;
      return parsed;
    } catch {
      healthy = false;
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  function start(): void {
    if (stopped) return;
    scrapeOnce();
    timer = setInterval(() => {
      if (!stopped) scrapeOnce();
    }, scrapeInterval);
  }

  function stop(): void {
    stopped = true;
    if (timer) {
      clearInterval(timer);
      timer = undefined;
    }
  }

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  function getMetric(name: string, labels?: Record<string, string>): MetricSample | null {
    const family = samples.get(name);
    if (!family || family.length === 0) return null;

    if (!labels) return family[0]!;

    return family.find((s) => Object.entries(labels).every(([k, v]) => s.labels[k] === v)) ?? null;
  }

  function getMetricFamily(name: string): MetricSample[] {
    return samples.get(name) ?? [];
  }

  function getCounterDelta(name: string, labels?: Record<string, string>): number {
    const family = samples.get(name);
    if (!family) return 0;

    let totalDelta = 0;
    for (const sample of family) {
      if (labels && !Object.entries(labels).every(([k, v]) => sample.labels[k] === v)) {
        continue;
      }

      const key = sampleKey(name, sample.labels);
      const prev = previousCounterValues.get(key);
      const curr = currentCounterValues.get(key);

      if (prev === undefined || curr === undefined) {
        // First scrape — no delta
        continue;
      }

      if (curr < prev) {
        // Counter reset — delta is the new value
        totalDelta += curr;
      } else {
        totalDelta += curr - prev;
      }
    }

    return totalDelta;
  }

  function onChange(name: string, callback: (sample: MetricSample) => void): () => void {
    let cbs = listeners.get(name);
    if (!cbs) {
      cbs = new Set();
      listeners.set(name, cbs);
    }
    cbs.add(callback);

    return () => {
      cbs!.delete(callback);
      if (cbs!.size === 0) listeners.delete(name);
    };
  }

  function isHealthy(): boolean {
    return healthy;
  }

  return {
    start,
    stop,
    scrapeOnce,
    getMetric,
    getMetricFamily,
    getCounterDelta,
    onChange,
    isHealthy,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sampleKey(name: string, labels: Record<string, string>): string {
  const sortedLabels = Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join(",");
  return `${name}{${sortedLabels}}`;
}
