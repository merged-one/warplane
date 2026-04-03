/** Inline SVG sparkline for latency time-series data. */

interface SparklinePoint {
  time: string;
  latencyMs: number;
}

export function LatencySparkline({
  data,
  width = 280,
  height = 48,
}: {
  data: SparklinePoint[];
  width?: number;
  height?: number;
}) {
  if (data.length < 2) {
    return <div className="muted">Not enough data for sparkline.</div>;
  }

  const values = data.map((d) => d.latencyMs);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  const padding = 2;
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;

  const points = data
    .map((d, i) => {
      const x = padding + (i / (data.length - 1)) * innerW;
      const y = padding + innerH - ((d.latencyMs - minVal) / range) * innerH;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} width={width} height={height}>
      <polyline fill="none" stroke="var(--accent)" strokeWidth="1.5" points={points} />
    </svg>
  );
}
