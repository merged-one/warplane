import { Link } from "react-router-dom";
import { useFetch, useFormatTime } from "../hooks.js";
import { getFailures } from "../api.js";
import { StatusBadge } from "../components/StatusBadge.js";
import { EventBadge } from "../components/EventBadge.js";
import { Loading } from "../components/Loading.js";
import { ErrorBox } from "../components/ErrorBox.js";

export function FailuresPage() {
  const { data, loading, error, reload } = useFetch(() =>
    getFailures({ pageSize: 100 }),
  );
  const fmt = useFormatTime();

  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;

  const failures = data?.failures ?? [];

  return (
    <div>
      <h1>Failures & Anomalies</h1>
      <p className="muted">
        Traces with status <code>failed</code>, <code>replay_blocked</code>, or{" "}
        <code>pending</code>.
      </p>

      {failures.length === 0 ? (
        <p className="muted">No failures found. All traces resolved successfully.</p>
      ) : (
        <div className="failure-list">
          {failures.map((t) => {
            const markerEvents = t.events.filter((e) =>
              [
                "execution_failed",
                "retry_requested",
                "retry_succeeded",
                "replay_blocked",
              ].includes(e.kind),
            );
            return (
              <div key={t.messageId} className="failure-card">
                <div className="failure-header">
                  <Link to={`/traces/${t.messageId}`} className="mono">
                    {t.messageId.slice(0, 16)}...
                  </Link>
                  <StatusBadge status={t.execution} />
                </div>
                <div className="failure-meta">
                  <span>Scenario: {t.scenario}</span>
                  <span>
                    {t.source.name} → {t.destination.name}
                  </span>
                  <span>{t.events.length} events</span>
                </div>
                {markerEvents.length > 0 && (
                  <div className="failure-markers">
                    {markerEvents.map((ev, i) => (
                      <div key={i} className="failure-marker-item">
                        <EventBadge kind={ev.kind} />
                        <span className="muted">
                          {fmt(ev.timestamp, "time")}
                        </span>
                        {ev.details && (
                          <span className="muted"> — {ev.details}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
