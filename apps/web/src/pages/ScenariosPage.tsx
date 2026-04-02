import { Link } from "react-router-dom";
import { useFetch, useFormatTime } from "../hooks.js";
import { getScenarios } from "../api.js";
import { Loading } from "../components/Loading.js";
import { ErrorBox } from "../components/ErrorBox.js";

export function ScenariosPage() {
  const { data, loading, error, reload } = useFetch(() => getScenarios());
  const fmt = useFormatTime();

  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;

  const scenarios = data?.scenarios ?? [];
  const passed = scenarios.filter((s) => s.passed).length;
  const failed = scenarios.filter((s) => !s.passed).length;

  return (
    <div>
      <h1>Scenario Runs</h1>
      <p className="muted">
        {scenarios.length} scenario(s) — {passed} passed, {failed} failed
      </p>

      <table className="table">
        <thead>
          <tr>
            <th>Scenario</th>
            <th>Passed</th>
            <th>Messages</th>
            <th>Started</th>
            <th>Completed</th>
            <th>Tags</th>
            <th>Error</th>
          </tr>
        </thead>
        <tbody>
          {scenarios.map((s) => (
            <tr key={s.scenario}>
              <td>
                <Link to={`/traces?scenario=${s.scenario}`}>{s.scenario}</Link>
              </td>
              <td>
                <span className={s.passed ? "text-green" : "text-red"}>
                  {s.passed ? "Yes" : "No"}
                </span>
              </td>
              <td>
                {s.messageIds.map((id) => (
                  <div key={id}>
                    <Link to={`/traces/${id}`} className="mono">
                      {id.slice(0, 12)}...
                    </Link>
                  </div>
                ))}
              </td>
              <td>{fmt(s.startedAt)}</td>
              <td>{fmt(s.completedAt)}</td>
              <td>{(s.tags ?? []).join(", ") || "—"}</td>
              <td className="text-red">{s.error ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <button onClick={reload} className="btn btn-sm" style={{ marginTop: 8 }}>
        Refresh
      </button>
    </div>
  );
}
