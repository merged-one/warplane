import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { getChains, getScenarios, getTraces } from "../api.js";
import type { ExecutionStatus, MessageTrace } from "../api.js";
import { useFetch, useFormatTime, useMediaQuery } from "../hooks.js";
import { ErrorBox } from "../components/ErrorBox.js";
import { Loading } from "../components/Loading.js";
import { StatusBadge } from "../components/StatusBadge.js";
import { getTraceLatencyLabel } from "../trace-utils.js";
import {
  applyTraceDraft,
  areTraceDraftFiltersEqual,
  countActiveTraceFilters,
  createEmptyTraceDraft,
  createTraceDraftFromQuery,
  createTracesParams,
  getTraceQuery,
  patchTraceQuery,
  serializeTraceQuery,
  type TraceDraftFilters,
  type TraceQueryState,
} from "./tracesQuery.js";

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
  const isMobile = useMediaQuery("(max-width: 768px)");
  const currentListUrl = `${location.pathname}${location.search}`;
  const committedQuery = getTraceQuery(searchParams);
  const [draftFilters, setDraftFilters] = useState(() => createTraceDraftFromQuery(committedQuery));
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const preserveDraftOnNextCommitRef = useRef(false);
  const filterButtonRef = useRef<HTMLButtonElement | null>(null);
  const filterDrawerCloseButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (preserveDraftOnNextCommitRef.current) {
      preserveDraftOnNextCommitRef.current = false;
      return;
    }

    setDraftFilters(createTraceDraftFromQuery(committedQuery));
  }, [
    committedQuery.destinationBlockchainId,
    committedQuery.legacyChain,
    committedQuery.messageId,
    committedQuery.page,
    committedQuery.scenario,
    committedQuery.sourceBlockchainId,
    committedQuery.status,
  ]);

  useEffect(() => {
    if (!isMobile && isFilterDrawerOpen) {
      setIsFilterDrawerOpen(false);
    }
  }, [isFilterDrawerOpen, isMobile]);

  useEffect(() => {
    if (!isFilterDrawerOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDrawer(true);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    filterDrawerCloseButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    committedQuery.destinationBlockchainId,
    committedQuery.legacyChain,
    committedQuery.messageId,
    committedQuery.page,
    committedQuery.scenario,
    committedQuery.sourceBlockchainId,
    committedQuery.status,
    isFilterDrawerOpen,
  ]);

  const { data, loading, error, reload } = useFetch(
    () =>
      getTraces({
        ...createTracesParams(committedQuery),
        pageSize: PAGE_SIZE,
      }),
    [
      committedQuery.destinationBlockchainId,
      committedQuery.legacyChain,
      committedQuery.messageId,
      committedQuery.page,
      committedQuery.scenario,
      committedQuery.sourceBlockchainId,
      committedQuery.status,
    ],
  );

  const scenariosRes = useFetch(() => getScenarios());
  const scenarioNames = (scenariosRes.data?.scenarios ?? []).map((entry) => entry.scenario);

  const chainsRes = useFetch(() => getChains());
  const chainOptions = (chainsRes.data?.chains ?? []).map((chainEntry) => ({
    id: chainEntry.blockchainId,
    name: chainEntry.name,
  }));

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const activeFilterCount = countActiveTraceFilters(committedQuery);
  const hasDraftChanges = !areTraceDraftFiltersEqual(draftFilters, committedQuery);
  const statusLabel =
    STATUS_CHIPS.find((chip) => chip.value === committedQuery.status)?.label ??
    committedQuery.status.replace(/_/g, " ");
  const sourceChainName =
    chainOptions.find((option) => option.id === committedQuery.sourceBlockchainId)?.name ??
    committedQuery.sourceBlockchainId;
  const destinationChainName =
    chainOptions.find((option) => option.id === committedQuery.destinationBlockchainId)?.name ??
    committedQuery.destinationBlockchainId;
  const legacyChainName =
    chainOptions.find((option) => option.id === committedQuery.legacyChain)?.name ??
    committedQuery.legacyChain;

  function commitQuery(nextQuery: TraceQueryState, opts?: { preserveDraft?: boolean }) {
    if (opts?.preserveDraft) {
      preserveDraftOnNextCommitRef.current = true;
    }

    setSearchParams(serializeTraceQuery(nextQuery));
  }

  function updateDraftFilter(
    key: keyof Pick<
      TraceDraftFilters,
      "scenario" | "sourceBlockchainId" | "destinationBlockchainId" | "messageId"
    >,
    value: string,
  ) {
    setDraftFilters((current) => {
      const nextDraft: TraceDraftFilters = {
        ...current,
        [key]: key === "messageId" ? value.trimStart() : value,
      };

      if ((key === "sourceBlockchainId" || key === "destinationBlockchainId") && value) {
        nextDraft.legacyChain = "";
      }

      return nextDraft;
    });
  }

  function openDrawer() {
    setDraftFilters(createTraceDraftFromQuery(committedQuery));
    setIsFilterDrawerOpen(true);
  }

  function closeDrawer(discardDraft: boolean) {
    if (discardDraft) {
      setDraftFilters(createTraceDraftFromQuery(committedQuery));
    }

    setIsFilterDrawerOpen(false);
    window.setTimeout(() => {
      filterButtonRef.current?.focus();
    }, 0);
  }

  function applyDraftFilters(options?: { closeDrawerAfterApply?: boolean }) {
    const nextQuery = applyTraceDraft(committedQuery, draftFilters);
    commitQuery(nextQuery);

    if (options?.closeDrawerAfterApply) {
      closeDrawer(false);
    }
  }

  function resetDraftFilters() {
    setDraftFilters(createEmptyTraceDraft());
  }

  function clearAllFilters() {
    setDraftFilters(createEmptyTraceDraft());
    commitQuery({
      scenario: "",
      status: "",
      sourceBlockchainId: "",
      destinationBlockchainId: "",
      legacyChain: "",
      messageId: "",
      page: 1,
    });

    if (isFilterDrawerOpen) {
      closeDrawer(false);
    }
  }

  function clearFilter(key: keyof TraceQueryState) {
    if (key === "status") {
      commitQuery(patchTraceQuery(committedQuery, { status: "" }), { preserveDraft: true });
      return;
    }

    if (key === "page") {
      return;
    }

    const nextQuery = patchTraceQuery(committedQuery, { [key]: "" } as Partial<TraceQueryState>);
    commitQuery(nextQuery);
  }

  function goToPage(nextPage: number) {
    commitQuery(patchTraceQuery(committedQuery, { page: nextPage }), { preserveDraft: true });
  }

  function openTrace(trace: MessageTrace) {
    navigate(`/traces/${trace.messageId}`, { state: { returnTo: currentListUrl } });
  }

  return (
    <div className="trace-workspace">
      <div className="trace-workspace-header">
        <h1>Traces</h1>
        <p className="muted trace-workspace-subtitle">
          Investigate live and historical message delivery without losing your route, scenario, or
          message search context.
        </p>
      </div>

      {isMobile && (
        <div className="trace-workspace-mobile-bar" data-testid="trace-mobile-toolbar">
          <div>
            <div className="trace-workspace-mobile-label">Results</div>
            <div className="trace-workspace-mobile-value">
              {loading && !data ? "Loading traces" : `${data?.total ?? 0} traces`}
            </div>
          </div>
          <div>
            <div className="trace-workspace-mobile-label">Active</div>
            <div className="trace-workspace-mobile-value">
              {formatFilterCount(activeFilterCount)}
            </div>
          </div>
          <button
            type="button"
            className="btn"
            onClick={openDrawer}
            ref={filterButtonRef}
            aria-expanded={isFilterDrawerOpen}
            aria-controls="trace-filter-drawer"
          >
            Filters
          </button>
        </div>
      )}

      {!isMobile && (
        <div className="trace-toolbar" data-testid="trace-filter-inline">
          <div className="trace-toolbar-header">
            <div className="trace-toolbar-status">
              <div className="trace-workspace-kicker">Quick status</div>
              <TraceStatusChips
                status={committedQuery.status}
                onSelect={(value) =>
                  commitQuery(patchTraceQuery(committedQuery, { status: value }), {
                    preserveDraft: true,
                  })
                }
              />
            </div>
            <p className="trace-toolbar-note">
              Status updates immediately. Scenario, route, and message filters stay staged until you
              apply them.
            </p>
          </div>

          <TraceFilterForm
            draftFilters={draftFilters}
            scenarioNames={scenarioNames}
            chainOptions={chainOptions}
            hasDraftChanges={hasDraftChanges}
            onApply={() => applyDraftFilters()}
            onResetDraft={resetDraftFilters}
            onUpdateDraft={updateDraftFilter}
          />
        </div>
      )}

      {isMobile && (
        <section className="trace-workspace-panel trace-workspace-panel-mobile-status">
          <div className="trace-workspace-kicker">Quick status</div>
          <TraceStatusChips
            status={committedQuery.status}
            onSelect={(value) =>
              commitQuery(patchTraceQuery(committedQuery, { status: value }), {
                preserveDraft: true,
              })
            }
          />
        </section>
      )}

      {activeFilterCount > 0 && (
        <div className="active-filter-list" aria-label="Active trace filters">
          {committedQuery.status && (
            <button
              type="button"
              className="active-filter-pill"
              onClick={() => clearFilter("status")}
            >
              Status: {statusLabel}
            </button>
          )}
          {committedQuery.scenario && (
            <button
              type="button"
              className="active-filter-pill"
              onClick={() => clearFilter("scenario")}
            >
              Scenario: {committedQuery.scenario}
            </button>
          )}
          {committedQuery.sourceBlockchainId && (
            <button
              type="button"
              className="active-filter-pill"
              onClick={() => clearFilter("sourceBlockchainId")}
            >
              Source: {sourceChainName}
            </button>
          )}
          {committedQuery.destinationBlockchainId && (
            <button
              type="button"
              className="active-filter-pill"
              onClick={() => clearFilter("destinationBlockchainId")}
            >
              Destination: {destinationChainName}
            </button>
          )}
          {committedQuery.legacyChain &&
            !committedQuery.sourceBlockchainId &&
            !committedQuery.destinationBlockchainId && (
              <button
                type="button"
                className="active-filter-pill"
                onClick={() => clearFilter("legacyChain")}
              >
                Any chain: {legacyChainName}
              </button>
            )}
          {committedQuery.messageId && (
            <button
              type="button"
              className="active-filter-pill"
              onClick={() => clearFilter("messageId")}
            >
              Message ID: {committedQuery.messageId}
            </button>
          )}
        </div>
      )}

      {loading && <Loading />}
      {error && <ErrorBox message={error} onRetry={reload} />}

      {data && (
        <>
          <div className="trace-results-summary" data-testid="trace-results-bar">
            <p className="muted trace-results-summary-copy">
              Showing {data.traces.length} of {data.total} traces (page {committedQuery.page} of{" "}
              {totalPages}, newest first)
            </p>
            <div className="trace-results-summary-actions">
              <button type="button" onClick={reload} className="btn btn-sm">
                Refresh
              </button>
              <button
                type="button"
                onClick={clearAllFilters}
                className="btn btn-sm"
                disabled={activeFilterCount === 0}
              >
                Clear all
              </button>
            </div>
          </div>

          <div className="trace-table-desktop" data-testid="trace-table-desktop">
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
                    <td colSpan={7}>
                      <EmptyTraceState onClear={clearAllFilters} />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="trace-cards-mobile" data-testid="trace-cards-mobile">
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

            {data.traces.length === 0 && <EmptyTraceState onClear={clearAllFilters} />}
          </div>

          <Pagination page={committedQuery.page} totalPages={totalPages} onGoToPage={goToPage} />
        </>
      )}

      {isMobile && isFilterDrawerOpen && (
        <div className="trace-filter-drawer-shell">
          <div className="trace-filter-drawer-backdrop" onClick={() => closeDrawer(true)} />
          <div
            className="trace-filter-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="trace-filter-drawer-title"
            id="trace-filter-drawer"
            data-testid="trace-filter-drawer"
          >
            <div className="trace-filter-drawer-header">
              <div>
                <div className="trace-workspace-kicker">Trace filters</div>
                <h2 id="trace-filter-drawer-title">Refine results</h2>
              </div>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => closeDrawer(true)}
                ref={filterDrawerCloseButtonRef}
              >
                Close
              </button>
            </div>

            <TraceFilterForm
              draftFilters={draftFilters}
              scenarioNames={scenarioNames}
              chainOptions={chainOptions}
              hasDraftChanges={hasDraftChanges}
              onApply={() => applyDraftFilters({ closeDrawerAfterApply: true })}
              onResetDraft={resetDraftFilters}
              onUpdateDraft={updateDraftFilter}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function TraceStatusChips({
  status,
  onSelect,
}: {
  status: ExecutionStatus | "";
  onSelect: (value: ExecutionStatus | "") => void;
}) {
  return (
    <div className="filter-chips" aria-label="Trace status filters">
      {STATUS_CHIPS.map((chip) => (
        <button
          key={chip.value}
          type="button"
          className={`chip${status === chip.value ? " chip-active" : ""}`}
          onClick={() => onSelect(chip.value)}
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}

function TraceFilterForm({
  draftFilters,
  scenarioNames,
  chainOptions,
  hasDraftChanges,
  onApply,
  onResetDraft,
  onUpdateDraft,
}: {
  draftFilters: TraceDraftFilters;
  scenarioNames: string[];
  chainOptions: Array<{ id: string; name: string }>;
  hasDraftChanges: boolean;
  onApply: () => void;
  onResetDraft: () => void;
  onUpdateDraft: (
    key: keyof Pick<
      TraceDraftFilters,
      "scenario" | "sourceBlockchainId" | "destinationBlockchainId" | "messageId"
    >,
    value: string,
  ) => void;
}) {
  return (
    <form
      className="trace-workspace-filter-form"
      onSubmit={(event) => {
        event.preventDefault();
        onApply();
      }}
    >
      {draftFilters.legacyChain && (
        <div className="trace-workspace-filter-note">
          Legacy any-chain filter from the URL is active and will be preserved until you replace it
          with source or destination filtering.
        </div>
      )}

      <div className="trace-workspace-filter-grid">
        <TraceSelectField
          label="Scenario"
          ariaLabel="Scenario filter"
          value={draftFilters.scenario}
          onChange={(value) => onUpdateDraft("scenario", value)}
          emptyLabel="All scenarios"
          options={scenarioNames.map((scenarioName) => ({
            label: scenarioName,
            value: scenarioName,
          }))}
        />

        <TraceSelectField
          label="Source chain"
          ariaLabel="Source chain filter"
          value={draftFilters.sourceBlockchainId}
          onChange={(value) => onUpdateDraft("sourceBlockchainId", value)}
          emptyLabel="Any source"
          options={chainOptions.map((option) => ({
            label: option.name,
            value: option.id,
          }))}
        />

        <TraceSelectField
          label="Destination chain"
          ariaLabel="Destination chain filter"
          value={draftFilters.destinationBlockchainId}
          onChange={(value) => onUpdateDraft("destinationBlockchainId", value)}
          emptyLabel="Any destination"
          options={chainOptions.map((option) => ({
            label: option.name,
            value: option.id,
          }))}
        />

        <label className="trace-workspace-filter-field">
          <span>Message ID</span>
          <input
            aria-label="Message ID filter"
            type="text"
            placeholder="Prefix match"
            value={draftFilters.messageId}
            onChange={(event) => onUpdateDraft("messageId", event.target.value)}
            className="trace-workspace-control input"
          />
        </label>
      </div>

      <div className="trace-workspace-filter-actions">
        <button type="button" className="btn" onClick={onResetDraft}>
          Reset
        </button>
        <button type="submit" className="btn btn-primary" disabled={!hasDraftChanges}>
          Apply filters
        </button>
      </div>
    </form>
  );
}

function TraceSelectField({
  label,
  ariaLabel,
  value,
  onChange,
  emptyLabel,
  options,
}: {
  label: string;
  ariaLabel: string;
  value: string;
  onChange: (value: string) => void;
  emptyLabel: string;
  options: Array<{ label: string; value: string }>;
}) {
  return (
    <label className="trace-workspace-filter-field">
      <span>{label}</span>
      <span className="trace-workspace-select">
        <select
          aria-label={ariaLabel}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">{emptyLabel}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </span>
    </label>
  );
}

function EmptyTraceState({ onClear }: { onClear: () => void }) {
  return (
    <div className="trace-workspace-empty">
      <p>No traces match the current filters.</p>
      <button type="button" className="btn btn-sm" onClick={onClear}>
        Clear filters
      </button>
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

function formatFilterCount(count: number): string {
  return `${count} active ${count === 1 ? "filter" : "filters"}`;
}
