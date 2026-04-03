/**
 * Prometheus text exposition format parser.
 *
 * Pure function — parses the text/plain; version=0.0.4 format into MetricSample[].
 * Handles comments (#), HELP/TYPE lines, labels, histogram suffixes,
 * scientific notation, and optional timestamps.
 *
 * @see https://prometheus.io/docs/instrumenting/exposition_formats/#text-based-format
 */

import type { MetricSample } from "./types.js";

/**
 * Parse Prometheus text exposition format into an array of MetricSample.
 * Skips malformed lines without throwing.
 */
export function parsePrometheusText(text: string): MetricSample[] {
  const samples: MetricSample[] = [];
  const lines = text.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and comments (HELP, TYPE, etc.)
    if (trimmed === "" || trimmed.startsWith("#")) continue;

    const sample = parseLine(trimmed);
    if (sample) samples.push(sample);
  }

  return samples;
}

// ---------------------------------------------------------------------------
// Line parser
// ---------------------------------------------------------------------------

function parseLine(line: string): MetricSample | null {
  try {
    // Metric line format: name{label1="val1",label2="val2"} value [timestamp]
    // or: name value [timestamp]
    let name: string;
    let labels: Record<string, string> = {};
    let rest: string;

    const braceIdx = line.indexOf("{");
    if (braceIdx !== -1) {
      name = line.slice(0, braceIdx);
      const closeBrace = line.indexOf("}", braceIdx);
      if (closeBrace === -1) return null;

      const labelStr = line.slice(braceIdx + 1, closeBrace);
      labels = parseLabels(labelStr);
      rest = line.slice(closeBrace + 1).trim();
    } else {
      const spaceIdx = line.indexOf(" ");
      if (spaceIdx === -1) return null;
      name = line.slice(0, spaceIdx);
      rest = line.slice(spaceIdx + 1).trim();
    }

    if (!name) return null;

    // Parse value and optional timestamp
    const parts = rest.split(/\s+/);
    if (parts.length === 0) return null;

    const value = parseFloat(parts[0]!);
    if (isNaN(value)) return null;

    const timestamp = parts.length > 1 ? parseInt(parts[1]!, 10) : Date.now();

    return { name, labels, value, timestamp: isNaN(timestamp) ? Date.now() : timestamp };
  } catch {
    return null;
  }
}

function parseLabels(labelStr: string): Record<string, string> {
  const labels: Record<string, string> = {};
  if (!labelStr) return labels;

  // Match label="value" pairs, handling escaped quotes in values
  const regex = /(\w+)="((?:[^"\\]|\\.)*)"/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(labelStr)) !== null) {
    labels[match[1]!] = match[2]!.replace(/\\(.)/g, "$1");
  }

  return labels;
}
