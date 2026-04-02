import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useFetch, useFormatTime } from "../hooks.js";
import { getTraces, getScenarios } from "../api.js";
import type { ExecutionStatus } from "../api.js";
import { StatusBadge } from "../components/StatusBadge.js";
import { Loading } from "../components/Loading.js";
import { ErrorBox } from "../components/ErrorBox.js";

const PAGE_SIZE = 50;

const STATUSES: ExecutionStatus[] = [
  "success",
  "retry_success",
  "failed",
  "replay_blocked",
  "pending",
];

export function TracesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const scenario = searchParams.get("scenario") ?? "";
  const status = searchParams.get("status") ?? "";
  const page = Number(searchParams.get("page") ?? "1");
  const [filterMsgId, setFilterMsgId] = useState("");
  const fmt = useFormatTime();

  const { data, loading, error, reload } = useFetch(
    () =>
      getTraces({
        scenario: scenario || undefined,
        status: status || undefined,
        messageId: filterMsgId || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    [scenario, status, filterMsgId, page],
  );

  const scenariosRes = useFetch(() => getScenarios());
  const scenarioNames = (scenariosRes.data?.scenarios ?? []).map((s) => s.scenario);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  function updateParam(key: string, val: string) {
    const next = new URLSearchParams(searchParams);
    if (val) next.set(key, val);
    else next.delete(key);
    next.delete("page");
    setSearchParams(next);
  }

  function goToPage(p: number) {
    const next = new URLSearchParams(searchParams);
    if (p > 1) next.set("page", String(p));
    else next.delete("page");
    setSearchParams(next);
  }

  return (
    <div>
      <h1>Traces</h1>

      <div className="filters">
        <label>
          Scenario:{" "}
          <select value={scenario} onChange={(e) => updateParam("scenario", e.target.value)}>
            <option value="">All</option>
            {scenarioNames.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status:{" "}
          <select value={status} onChange={(e) => updateParam("status", e.target.value)}>
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label>
          Message ID:{" "}
          <input
            type="text"
            placeholder="prefix search..."
            value={filterMsgId}
            onChange={(e) => setFilterMsgId(e.target.value)}
            className="input"
          />
        </label>
        <button onClick={reload} className="btn btn-sm">
          Refresh
        </button>
      </div>

      {loading && <Loading />}
      {error && <ErrorBox message={error} onRetry={reload} />}

      {data && (
        <>
          <p className="muted">
            Showing {data.traces.length} of {data.total} traces (page {data.page})
          </p>
          <table className="table">
            <thead>
              <tr>
                <th>Message ID</th>
                <th>Scenario</th>
                <th>Status</th>
                <th>Source</th>
                <th>Dest</th>
                <th>Events</th>
                <th>Send Time</th>
              </tr>
            </thead>
            <tbody>
              {data.traces.map((t) => (
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
                  <td>{t.events.length}</td>
                  <td>{fmt(t.timestamps.sendTime)}</td>
                </tr>
              ))}
              {data.traces.length === 0 && (
                <tr>
                  <td colSpan={7} className="muted">
                    No traces match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <Pagination page={page} totalPages={totalPages} onGoToPage={goToPage} />
        </>
      )}
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  onGoToPage,
}: {
  page: number;
  totalPages: number;
  onGoToPage: (p: number) => void;
}) {
  const [jumpInput, setJumpInput] = useState("");

  function handleJump(e: React.FormEvent) {
    e.preventDefault();
    const p = Number(jumpInput);
    if (p >= 1 && p <= totalPages) {
      onGoToPage(p);
      setJumpInput("");
    }
  }

  return (
    <div className="pagination">
      <button disabled={page <= 1} onClick={() => onGoToPage(page - 1)} className="btn btn-sm">
        Prev
      </button>
      <span>
        Page {page} of {totalPages}
      </span>
      <button
        disabled={page >= totalPages}
        onClick={() => onGoToPage(page + 1)}
        className="btn btn-sm"
      >
        Next
      </button>
      {totalPages > 2 && (
        <form onSubmit={handleJump} className="pagination-jump">
          <input
            type="number"
            min={1}
            max={totalPages}
            placeholder="Go to"
            value={jumpInput}
            onChange={(e) => setJumpInput(e.target.value)}
            className="input pagination-input"
          />
          <button type="submit" className="btn btn-sm">
            Go
          </button>
        </form>
      )}
    </div>
  );
}
