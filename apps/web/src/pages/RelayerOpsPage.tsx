import { useFetch } from "../hooks.js";
import {
  getRelayerHealth,
  getSigAggHealth,
  getFailureClassification,
  getLatencyStats,
} from "../api.js";
import { HealthBadge } from "../components/HealthBadge.js";
import { FailureChart } from "../components/FailureChart.js";
import { LatencySparkline } from "../components/LatencySparkline.js";
import { StakeWeightBar } from "../components/StakeWeightBar.js";
import { Loading } from "../components/Loading.js";
import { ErrorBox } from "../components/ErrorBox.js";

export function RelayerOpsPage() {
  const relayerHealth = useFetch(() => getRelayerHealth());
  const sigAggHealth = useFetch(() => getSigAggHealth());
  const failures = useFetch(() => getFailureClassification());
  const latency = useFetch(() => getLatencyStats());

  const loading =
    relayerHealth.loading || sigAggHealth.loading || failures.loading || latency.loading;
  const error = relayerHealth.error || sigAggHealth.error || failures.error || latency.error;

  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} />;

  const relayers = relayerHealth.data?.health ?? [];
  const sigAgg = sigAggHealth.data?.health ?? null;
  const failureList = failures.data?.failures ?? [];
  const latencyData = latency.data ?? { p50: 0, p90: 0, p99: 0, timeSeries: [] };

  return (
    <div>
      <h1>Relayer Operations</h1>

      {/* Health Overview */}
      <section className="section">
        <h2>Health Overview</h2>
        {relayers.length === 0 ? (
          <div className="muted">
            No relayer health data available. Health snapshots are populated when the Prometheus
            metrics scraper is running.
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Relayer</th>
                <th>Status</th>
                <th>Success Rate</th>
                <th>Latency</th>
                <th>Lag</th>
                <th>Pending</th>
              </tr>
            </thead>
            <tbody>
              {relayers.map((r) => (
                <tr key={r.relayerId}>
                  <td className="mono">{r.relayerId}</td>
                  <td>
                    <HealthBadge status={r.status} />
                  </td>
                  <td>{r.successRate != null ? `${r.successRate.toFixed(1)}%` : "—"}</td>
                  <td>{r.latencyMs != null ? `${(r.latencyMs / 1000).toFixed(1)}s` : "—"}</td>
                  <td>{r.lagBlocks ?? "—"}</td>
                  <td>{r.pendingMessages ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <div className="ops-grid">
        {/* Signature Aggregator */}
        <div className="ops-panel">
          <h3>Signature Aggregator</h3>
          {!sigAgg ? (
            <div className="muted">No sig-agg health data available.</div>
          ) : (
            <>
              <div style={{ marginBottom: 12 }}>
                <HealthBadge status={sigAgg.status} />
                {sigAgg.aggregationLatency != null && (
                  <span className="muted" style={{ marginLeft: 12 }}>
                    Latency: {(sigAgg.aggregationLatency / 1000).toFixed(1)}s
                  </span>
                )}
                {sigAgg.cacheHitRate != null && (
                  <span className="muted" style={{ marginLeft: 12 }}>
                    Cache Hit: {(sigAgg.cacheHitRate * 100).toFixed(0)}%
                  </span>
                )}
              </div>
              <div>
                <h4 style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: 8 }}>
                  Connected Stake
                </h4>
                {Object.keys(sigAgg.connectedStake).length === 0 ? (
                  <div className="muted">No stake data.</div>
                ) : (
                  Object.entries(sigAgg.connectedStake).map(([subnet, pct]) => (
                    <StakeWeightBar key={subnet} label={subnet} percent={pct} />
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* Failure Classification */}
        <div className="ops-panel">
          <h3>Failure Classification (Last 24h)</h3>
          <FailureChart failures={failureList} />
        </div>

        {/* Delivery Latency */}
        <div className="ops-panel" style={{ gridColumn: "1 / -1" }}>
          <h3>Delivery Latency (Last 24h)</h3>
          <div className="latency-stats">
            <div className="latency-stat">
              <div className="latency-stat-label">p50</div>
              <div className="latency-stat-value">
                {latencyData.p50 > 0 ? `${(latencyData.p50 / 1000).toFixed(1)}s` : "—"}
              </div>
            </div>
            <div className="latency-stat">
              <div className="latency-stat-label">p90</div>
              <div className="latency-stat-value">
                {latencyData.p90 > 0 ? `${(latencyData.p90 / 1000).toFixed(1)}s` : "—"}
              </div>
            </div>
            <div className="latency-stat">
              <div className="latency-stat-label">p99</div>
              <div className="latency-stat-value">
                {latencyData.p99 > 0 ? `${(latencyData.p99 / 1000).toFixed(1)}s` : "—"}
              </div>
            </div>
          </div>
          <LatencySparkline data={latencyData.timeSeries} />
        </div>
      </div>
    </div>
  );
}
