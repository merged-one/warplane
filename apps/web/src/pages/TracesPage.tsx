import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { getChains, getScenarios, getTraces } from "../api.js";
import type { ExecutionStatus, MessageTrace } from "../api.js";
import { useDebouncedValue, useFetch, useFormatTime } from "../hooks.js";
import { ErrorBox } from "../components/ErrorBox.js";
import { Loading } from "../components/Loading.js";
import { StatusBadge } from "../components/StatusBadge.js";
import { getTraceLatencyLabel } from "../trace-utils.js";

const PAGE_SIZE = 50;

const STATUS_CHIPS: Array<{ value: ExecutionStatus | ""; label: string }> = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "success", label: "Delivered" },
  { value: "failed", label: "Failed" },
  { value: "retry_success", label: "Retrying" },
  { value: "replay_blocked", label: "Blocked" },
];

export function TracesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const fmt = useFormatTime();
  const messageIdSyncTargetRef = useRef<string | null>(null);

  const scenario = searchParams.get("scenario") ?? "";
  const status = searchParams.get("status") ?? "";
  const sourceBlockchainId = searchParams.get("sourceBlockchainId") ?? "";
  const destinationBlockchainId = searchParams.get("destinationBlockchainId") ?? "";
  const messageId = searchParams.get("messageId") ?? "";
  const legacyChain = searchParams.get("chain") ?? "";
  const page = Number(searchParams.get("page") ?? "1");
  const currentListUrl = `${location.pathname}${location.search}`;

  const [messageIdInput, setMessageIdInput] = useState(messageId);
  const debouncedMessageId = useDebouncedValue(messageIdInput.trim(), 300);

  useEffect(() => {
    if (messageIdInput !== messageId) {
      messageIdSyncTargetRef.current = messageId;
      setMessageIdInput(messageId);
    }
  }, [messageId]);

  useEffect(() => {
    if (messageIdSyncTargetRef.current !== null) {
      if (debouncedMessageId === messageIdSyncTargetRef.current) {
        messageIdSyncTargetRef.current = null;
      }
      return;
    }

    if (debouncedMessageId === messageId) {
      return;
    }

    const next = new URLSearchParams(searchParams);
    if (debouncedMessageId) next.set("messageId", debouncedMessageId);
    else next.delete("messageId");
    next.delete("page");
    setSearchParams(next);
  }, [debouncedMessageId, messageId, searchParams, setSearchParams]);

  const { data, loading, error, reload } = useFetch(
    () =>
      getTraces({
        scenario: scenario || undefined,
        status: status || undefined,
        chain:
          !sourceBlockchainId && !destinationBlockchainId ? legacyChain || undefined : undefined,
        sourceBlockchainId: sourceBlockchainId || undefined,
        destinationBlockchainId: destinationBlockchainId || undefined,
        messageId: messageId || undefined,
        sort: "newest",
        page,
        pageSize: PAGE_SIZE,
      }),
    [scenario, status, sourceBlockchainId, destinationBlockchainId, legacyChain, messageId, page],
  );

  const scenariosRes = useFetch(() => getScenarios());
  const scenarioNames = (scenariosRes.data?.scenarios ?? []).map((entry) => entry.scenario);

  const chainsRes = useFetch(() => getChains());
  const chainOptions = (chainsRes.data?.chains ?? []).map((chainEntry) => ({
    id: chainEntry.blockchainId,
    name: chainEntry.name,
  }));

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const statusLabel =
    STATUS_CHIPS.find((chip) => chip.value === status)?.label ?? status.replace(/_/g, " ");
  const sourceChainName =
    chainOptions.find((option) => option.id === sourceBlockchainId)?.name ?? sourceBlockchainId;
  const destinationChainName =
    chainOptions.find((option) => option.id === destinationBlockchainId)?.name ??
    destinationBlockchainId;
  const legacyChainName =
    chainOptions.find((option) => option.id === legacyChain)?.name ?? legacyChain;
  const activeFilterCount = [
    scenario,
    status,
    sourceBlockchainId,
    destinationBlockchainId,
    legacyChain,
    messageId,
  ].filter(Boolean).length;

  function updateParam(key: string, value: string, opts?: { clearLegacyChain?: boolean }) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (opts?.clearLegacyChain) next.delete("chain");
    next.delete("page");
    setSearchParams(next);
  }

  function clearAllFilters() {
    messageIdSyncTargetRef.current = "";
    setMessageIdInput("");
    setSearchParams(new URLSearchParams());
  }

  function clearMessageIdFilter() {
    messageIdSyncTargetRef.current = "";
    setMessageIdInput("");
    updateParam("messageId", "");
  }

  function goToPage(nextPage: number) {
    const next = new URLSearchParams(searchParams);
    if (nextPage > 1) next.set("page", String(nextPage));
    else next.delete("page");
    setSearchParams(next);
  }

  function openTrace(trace: MessageTrace) {
    navigate(`/traces/${trace.messageId}`, { state: { returnTo: currentListUrl } });
  }

  return (
    <div>
      <h1>Traces</h1>
      <p className="muted trace-page-subtitle">
        Filter by status, route, or message ID, then drill into the full lifecycle without losing
        list context.
      </p>

      <div className="trace-toolbar">
        <div className="filter-chips" aria-label="Trace status filters">
          {STATUS_CHIPS.map((chip) => (
            <button
              key={chip.value}
              className={`chip${status === chip.value ? " chip-active" : ""}`}
              onClick={() => updateParam("status", chip.value)}
            >
              {chip.label}
            </button>
          ))}
        </div>

        <div className="trace-filter-grid">
          <label className="filter-field">
            <span>Scenario</span>
            <select
              aria-label="Scenario filter"
              value={scenario}
              onChange={(event) => updateParam("scenario", event.target.value)}
            >
              <option value="">All scenarios</option>
              {scenarioNames.map((scenarioName) => (
                <option key={scenarioName} value={scenarioName}>
                  {scenarioName}
                </option>
              ))}
            </select>
          </label>

          <label className="filter-field">
            <span>Source chain</span>
            <select
              aria-label="Source chain filter"
              value={sourceBlockchainId}
              onChange={(event) =>
                updateParam("sourceBlockchainId", event.target.value, { clearLegacyChain: true })
              }
            >
              <option value="">Any source</option>
              {chainOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>

          <label className="filter-field">
            <span>Destination chain</span>
            <select
              aria-label="Destination chain filter"
              value={destinationBlockchainId}
              onChange={(event) =>
                updateParam("destinationBlockchainId", event.target.value, {
                  clearLegacyChain: true,
                })
              }
            >
              <option value="">Any destination</option>
              {chainOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>

          <label className="filter-field filter-field-wide">
            <span>Message ID</span>
            <input
              aria-label="Message ID filter"
              type="text"
              placeholder="Debounced prefix search"
              value={messageIdInput}
              onChange={(event) => setMessageIdInput(event.target.value)}
              className="input"
            />
          </label>
        </div>

        <div className="trace-toolbar-actions">
          <button onClick={reload} className="btn btn-sm">
            Refresh
          </button>
          <button
            onClick={clearAllFilters}
            className="btn btn-sm"
            disabled={activeFilterCount === 0}
          >
            Clear all
          </button>
        </div>
      </div>

      {activeFilterCount > 0 && (
        <div className="active-filter-list" aria-label="Active trace filters">
          {status && (
            <button className="active-filter-pill" onClick={() => updateParam("status", "")}>
              Status: {statusLabel}
            </button>
          )}
          {scenario && (
            <button className="active-filter-pill" onClick={() => updateParam("scenario", "")}>
              Scenario: {scenario}
            </button>
          )}
          {sourceBlockchainId && (
            <button
              className="active-filter-pill"
              onClick={() => updateParam("sourceBlockchainId", "", { clearLegacyChain: true })}
            >
              Source: {sourceChainName}
            </button>
          )}
          {destinationBlockchainId && (
            <button
              className="active-filter-pill"
              onClick={() => updateParam("destinationBlockchainId", "", { clearLegacyChain: true })}
            >
              Destination: {destinationChainName}
            </button>
          )}
          {legacyChain && !sourceBlockchainId && !destinationBlockchainId && (
            <button className="active-filter-pill" onClick={() => updateParam("chain", "")}>
              Any chain: {legacyChainName}
            </button>
          )}
          {messageId && (
            <button className="active-filter-pill" onClick={clearMessageIdFilter}>
              Message ID: {messageId}
            </button>
          )}
        </div>
      )}

      {loading && <Loading />}
      {error && <ErrorBox message={error} onRetry={reload} />}

      {data && (
        <>
          <p className="muted trace-results-summary">
            Showing {data.traces.length} of {data.total} traces (page {data.page}, newest first)
          </p>

          <div className="trace-table-desktop">
            <table className="table">
              <thead>
                <tr>
                  <th>Message</th>
                  <th>Status</th>
                  <th>Route</th>
                  <th>Scenario</th>
                  <th>Events</th>
                  <th>Latency</th>
                  <th>Sent</th>
                </tr>
              </thead>
              <tbody>
                {data.traces.map((trace) => (
                  <tr
                    key={trace.messageId}
                    className="trace-row"
                    onClick={() => openTrace(trace)}
                    style={{ cursor: "pointer" }}
                  >
                    <td>
                      <Link
                        to={`/traces/${trace.messageId}`}
                        state={{ returnTo: currentListUrl }}
                        className="mono trace-row-link"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {trace.messageId.slice(0, 12)}...
                      </Link>
                      {trace.execution === "pending" && (
                        <span className="trace-live-state">
                          <span className="live-dot" title="In progress" /> Live
                        </span>
                      )}
                    </td>
                    <td>
                      <StatusBadge status={trace.execution} />
                    </td>
                    <td>
                      {trace.source.name} → {trace.destination.name}
                    </td>
                    <td>{trace.scenario}</td>
                    <td>{trace.events.length}</td>
                    <td>{getTraceLatencyLabel(trace)}</td>
                    <td>{fmt(trace.timestamps.sendTime)}</td>
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
          </div>

          <div className="trace-cards-mobile">
            {data.traces.map((trace) => (
              <article
                key={trace.messageId}
                className="trace-card"
                onClick={() => openTrace(trace)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openTrace(trace);
                  }
                }}
              >
                <div className="trace-card-header">
                  <Link
                    to={`/traces/${trace.messageId}`}
                    state={{ returnTo: currentListUrl }}
                    className="mono trace-row-link"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {trace.messageId.slice(0, 16)}...
                  </Link>
                  <StatusBadge status={trace.execution} />
                </div>
                <div className="trace-card-route">
                  {trace.source.name} → {trace.destination.name}
                </div>
                <div className="trace-card-grid">
                  <span>Scenario</span>
                  <span>{trace.scenario}</span>
                  <span>Events</span>
                  <span>{trace.events.length}</span>
                  <span>Latency</span>
                  <span>{getTraceLatencyLabel(trace)}</span>
                  <span>Sent</span>
                  <span>{fmt(trace.timestamps.sendTime)}</span>
                </div>
                {trace.execution === "pending" && (
                  <div className="trace-live-state">
                    <span className="live-dot" title="In progress" /> Live trace
                  </div>
                )}
              </article>
            ))}
            {data.traces.length === 0 && (
              <p className="muted">No traces match the current filters.</p>
            )}
          </div>

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
  onGoToPage: (pageNumber: number) => void;
}) {
  const [jumpInput, setJumpInput] = useState("");

  function handleJump(event: React.FormEvent) {
    event.preventDefault();
    const nextPage = Number(jumpInput);
    if (nextPage >= 1 && nextPage <= totalPages) {
      onGoToPage(nextPage);
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
            onChange={(event) => setJumpInput(event.target.value)}
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
