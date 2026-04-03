import { useFetch, useFormatTime } from "../hooks.js";
import { getHealth, getChains, getNetworks, getTraces, getScenarios } from "../api.js";
import { StatusBadge } from "../components/StatusBadge.js";
import { DemoBanner } from "../components/DemoBanner.js";
import { Loading } from "../components/Loading.js";
import { ErrorBox } from "../components/ErrorBox.js";
import { Link } from "react-router-dom";
import type { ExecutionStatus } from "../api.js";

export function OverviewPage() {
  const health = useFetch(() => getHealth());
  const chains = useFetch(() => getChains());
  const networks = useFetch(() => getNetworks());
  const traces = useFetch(() => getTraces({ pageSize: 200 }));
  const scenarios = useFetch(() => getScenarios());
  const fmt = useFormatTime();

  const loading =
    health.loading || chains.loading || networks.loading || traces.loading || scenarios.loading;
  const error = health.error || chains.error || networks.error || traces.error || scenarios.error;

  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} />;

  const statusCounts: Record<string, number> = {};
  for (const t of traces.data?.traces ?? []) {
    statusCounts[t.execution] = (statusCounts[t.execution] ?? 0) + 1;
  }

  const scenarioList = scenarios.data?.scenarios ?? [];
  const passed = scenarioList.filter((s) => s.passed).length;
  const failed = scenarioList.filter((s) => !s.passed).length;

  return (
    <div>
      {health.data?.demoMode && <DemoBanner />}
      <h1>Overview</h1>

      <div className="card-grid">
        <div className="card">
          <div className="card-label">Traces</div>
          <div className="card-value">{health.data?.traceCount ?? 0}</div>
        </div>
        <div className="card">
          <div className="card-label">Chains</div>
          <div className="card-value">{chains.data?.chains.length ?? 0}</div>
        </div>
        <div className="card">
          <div className="card-label">Networks</div>
          <div className="card-value">{networks.data?.networks.length ?? 0}</div>
        </div>
        <div className="card">
          <div className="card-label">Scenarios</div>
          <div className="card-value">
            {passed} passed / {failed} failed
          </div>
        </div>
      </div>

      <section className="section">
        <h2>Trace Status Breakdown</h2>
        <div className="status-bar">
          {Object.entries(statusCounts).map(([status, count]) => (
            <Link key={status} to={`/traces?status=${status}`} className="status-bar-segment">
              <StatusBadge status={status as ExecutionStatus} /> {count}
            </Link>
          ))}
        </div>
      </section>

      <section className="section">
        <h2>Chain Registry</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Blockchain ID</th>
              <th>EVM Chain ID</th>
            </tr>
          </thead>
          <tbody>
            {(chains.data?.chains ?? []).map((c) => (
              <tr key={c.blockchainId}>
                <td>{c.name}</td>
                <td className="mono">{c.blockchainId.slice(0, 16)}...</td>
                <td>{c.evmChainId}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="section">
        <h2>Scenario Coverage</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Scenario</th>
              <th>Passed</th>
              <th>Messages</th>
              <th>Completed</th>
            </tr>
          </thead>
          <tbody>
            {scenarioList.map((s) => (
              <tr key={s.scenario}>
                <td>
                  <Link to={`/traces?scenario=${s.scenario}`}>{s.scenario}</Link>
                </td>
                <td>
                  <span className={s.passed ? "text-green" : "text-red"}>
                    {s.passed ? "Yes" : "No"}
                  </span>
                </td>
                <td>{s.messageIds.length}</td>
                <td>{fmt(s.completedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="section">
        <h2>Recent Traces</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Message ID</th>
              <th>Scenario</th>
              <th>Status</th>
              <th>Source</th>
              <th>Destination</th>
            </tr>
          </thead>
          <tbody>
            {(traces.data?.traces ?? []).slice(0, 5).map((t) => (
              <tr key={t.messageId}>
                <td>
                  <Link to={`/traces/${t.messageId}`} className="mono">
                    {t.messageId.slice(0, 12)}...
                  </Link>
                </td>
                <td>{t.scenario}</td>
                <td>
                  <StatusBadge status={t.execution} />
                </td>
                <td>{t.source.name}</td>
                <td>{t.destination.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Link to="/traces" className="btn btn-sm" style={{ marginTop: 8 }}>
          View all traces
        </Link>
      </section>
    </div>
  );
}
