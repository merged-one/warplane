import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { useFetch, useFormatTime } from "../hooks.js";
import { getTrace, getTraceRaw } from "../api.js";
import type { MessageEvent } from "../api.js";
import { StatusBadge } from "../components/StatusBadge.js";
import { EventTimeline } from "../components/EventTimeline.js";
import { Loading } from "../components/Loading.js";
import { ErrorBox } from "../components/ErrorBox.js";

export function TraceDetailPage() {
  const { messageId } = useParams<{ messageId: string }>();
  const { data: trace, loading, error } = useFetch(() => getTrace(messageId!), [messageId]);
  const [showRaw, setShowRaw] = useState(false);
  const rawFetch = useFetch(() => getTraceRaw(messageId!), [messageId]);
  const fmt = useFormatTime();

  // Auto-refresh every 5s for in-progress traces
  const [refreshTick, setRefreshTick] = useState(0);
  useEffect(() => {
    if (trace?.execution !== "pending") return;
    const id = window.setInterval(() => setRefreshTick((t) => t + 1), 5000);
    return () => window.clearInterval(id);
  }, [trace?.execution]);

  // Re-fetch on tick
  const { data: liveTrace } = useFetch(() => getTrace(messageId!), [messageId, refreshTick]);
  const displayTrace = liveTrace ?? trace;

  // Event selection
  const [selectedEventIdx, setSelectedEventIdx] = useState<number | undefined>();
  const selectedEvent =
    selectedEventIdx != null ? displayTrace?.events[selectedEventIdx] : undefined;

  const handleSelectEvent = useCallback((_ev: MessageEvent, idx: number) => {
    setSelectedEventIdx((prev) => (prev === idx ? undefined : idx));
  }, []);

  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} />;
  if (!displayTrace) return <ErrorBox message="Trace not found" />;

  // Compute duration
  const sendMs = new Date(displayTrace.timestamps.sendTime).getTime();
  const recvMs = new Date(displayTrace.timestamps.receiveTime).getTime();
  const durationMs = recvMs - sendMs;
  const durationStr = durationMs > 0 ? `${(durationMs / 1000).toFixed(1)}s` : "—";

  return (
    <div>
      <nav className="breadcrumb">
        <Link to="/traces">&larr; Back to Traces</Link>
      </nav>

      <div className="trace-header">
        <h1>
          Trace Detail <StatusBadge status={displayTrace.execution} />
          {displayTrace.execution === "pending" && (
            <span className="live-dot" title="Auto-refreshing" />
          )}
        </h1>
      </div>

      <div className="card-grid">
        <div className="card">
          <div className="card-label">Message ID</div>
          <div className="card-value mono" style={{ fontSize: "0.85rem", wordBreak: "break-all" }}>
            {displayTrace.messageId}
          </div>
        </div>
        <div className="card">
          <div className="card-label">Route</div>
          <div className="card-value trace-chain-flow">
            {displayTrace.source.name} <span className="arrow">&rarr;</span>{" "}
            {displayTrace.destination.name}
          </div>
        </div>
        <div className="card">
          <div className="card-label">Duration</div>
          <div className="card-value">{durationStr}</div>
        </div>
        <div className="card">
          <div className="card-label">Events</div>
          <div className="card-value">{displayTrace.events.length}</div>
        </div>
      </div>

      <section className="section">
        <h2>Addresses</h2>
        <dl className="dl">
          <dt>Sender</dt>
          <dd className="mono">{displayTrace.sender}</dd>
          <dt>Recipient</dt>
          <dd className="mono">{displayTrace.recipient}</dd>
          {displayTrace.relayer && (
            <>
              <dt>Relayer</dt>
              <dd className="mono">{displayTrace.relayer.address}</dd>
            </>
          )}
        </dl>
      </section>

      <section className="section">
        <h2>Transaction Hashes</h2>
        <dl className="dl">
          <dt>Source Tx</dt>
          <dd className="mono">{displayTrace.sourceTxHash}</dd>
          {displayTrace.relayTxHash && (
            <>
              <dt>Relay Tx</dt>
              <dd className="mono">{displayTrace.relayTxHash}</dd>
            </>
          )}
          {displayTrace.destinationTxHash && (
            <>
              <dt>Destination Tx</dt>
              <dd className="mono">{displayTrace.destinationTxHash}</dd>
            </>
          )}
        </dl>
      </section>

      {displayTrace.fee && (
        <section className="section">
          <h2>Fee Info</h2>
          <dl className="dl">
            <dt>Token</dt>
            <dd className="mono">{displayTrace.fee.feeTokenAddress}</dd>
            <dt>Initial</dt>
            <dd>{displayTrace.fee.initialAmount}</dd>
            <dt>Added</dt>
            <dd>{displayTrace.fee.addedAmount}</dd>
            <dt>Total</dt>
            <dd>{displayTrace.fee.totalAmount}</dd>
          </dl>
        </section>
      )}

      {displayTrace.retry && (
        <section className="section">
          <h2>Retry Info</h2>
          <dl className="dl">
            <dt>Original Gas Limit</dt>
            <dd>{displayTrace.retry.originalGasLimit}</dd>
            <dt>Retry Gas Limit</dt>
            <dd>{displayTrace.retry.retryGasLimit}</dd>
            <dt>Retry Tx</dt>
            <dd className="mono">{displayTrace.retry.retryTxHash}</dd>
          </dl>
        </section>
      )}

      <section className="section">
        <h2>Lifecycle Timeline</h2>
        <EventTimeline
          events={displayTrace.events}
          selectedIndex={selectedEventIdx}
          onSelectEvent={handleSelectEvent}
        />
      </section>

      {selectedEvent && (
        <div className="event-detail-panel">
          <h3>Event Details</h3>
          <dl className="dl">
            <dt>Kind</dt>
            <dd>{selectedEvent.kind.replace(/_/g, " ")}</dd>
            <dt>Timestamp</dt>
            <dd>{fmt(selectedEvent.timestamp)}</dd>
            {selectedEvent.chain && (
              <>
                <dt>Chain</dt>
                <dd>{selectedEvent.chain}</dd>
              </>
            )}
            {selectedEvent.blockNumber != null && (
              <>
                <dt>Block Number</dt>
                <dd>{selectedEvent.blockNumber.toLocaleString()}</dd>
              </>
            )}
            {selectedEvent.txHash && (
              <>
                <dt>Transaction Hash</dt>
                <dd className="mono">{selectedEvent.txHash}</dd>
              </>
            )}
            {selectedEvent.details && (
              <>
                <dt>Details</dt>
                <dd>{selectedEvent.details}</dd>
              </>
            )}
          </dl>
        </div>
      )}

      <section className="section">
        <h2>
          Raw JSON{" "}
          <button onClick={() => setShowRaw(!showRaw)} className="btn btn-sm">
            {showRaw ? "Hide" : "Show"}
          </button>
        </h2>
        {showRaw && rawFetch.data && (
          <pre className="raw-json">{JSON.stringify(rawFetch.data, null, 2)}</pre>
        )}
        {showRaw && rawFetch.loading && <Loading label="Loading raw JSON..." />}
        {showRaw && rawFetch.error && <ErrorBox message={rawFetch.error} />}
      </section>
    </div>
  );
}
