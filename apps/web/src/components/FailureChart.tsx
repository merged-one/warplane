import type { FailureClassification } from "../api.js";

export function FailureChart({ failures }: { failures: FailureClassification[] }) {
  if (failures.length === 0) {
    return <div className="muted">No failures in the last 24 hours.</div>;
  }

  const maxCount = Math.max(...failures.map((f) => f.count));

  return (
    <div className="failure-chart">
      {failures.map((f) => (
        <div key={f.reason} className="failure-bar">
          <span className="failure-bar-label">{f.reason.replace(/_/g, " ")}</span>
          <div className="failure-bar-track">
            <div className="failure-bar-fill" style={{ width: `${(f.count / maxCount) * 100}%` }} />
          </div>
          <span className="failure-bar-count">{f.count}</span>
        </div>
      ))}
    </div>
  );
}
