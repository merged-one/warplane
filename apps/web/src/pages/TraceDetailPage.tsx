import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useFetch, useFormatTime } from "../hooks.js";
import { getTrace, getTraceRaw } from "../api.js";
import { StatusBadge } from "../components/StatusBadge.js";
import { EventBadge } from "../components/EventBadge.js";
import { Loading } from "../components/Loading.js";
import { ErrorBox } from "../components/ErrorBox.js";

export function TraceDetailPage() {
  const { messageId } = useParams<{ messageId: string }>();
  const { data: trace, loading, error } = useFetch(
    () => getTrace(messageId!),
    [messageId],
  );
  const [showRaw, setShowRaw] = useState(false);
  const rawFetch = useFetch(() => getTraceRaw(messageId!), [messageId]);
  const fmt = useFormatTime();

  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} />;
  if (!trace) return <ErrorBox message="Trace not found" />;

  return (
    <div>
      <nav className="breadcrumb">
        <Link to="/traces">Traces</Link> / <span className="mono">{messageId?.slice(0, 16)}...</span>
      </nav>

      <h1>
        Trace Detail <StatusBadge status={trace.execution} />
      </h1>

      <div className="card-grid">
        <div className="card">
          <div className="card-label">Scenario</div>
          <div className="card-value">{trace.scenario}</div>
        </div>
        <div className="card">
          <div className="card-label">Source</div>
          <div className="card-value">{trace.source.name}</div>
        </div>
        <div className="card">
          <div className="card-label">Destination</div>
          <div className="card-value">{trace.destination.name}</div>
        </div>
        <div className="card">
          <div className="card-label">Events</div>
          <div className="card-value">{trace.events.length}</div>
        </div>
      </div>

      <section className="section">
        <h2>Addresses</h2>
        <dl className="dl">
          <dt>Message ID</dt>
          <dd className="mono">{trace.messageId}</dd>
          <dt>Sender</dt>
          <dd className="mono">{trace.sender}</dd>
          <dt>Recipient</dt>
          <dd className="mono">{trace.recipient}</dd>
          {trace.relayer && (
            <>
              <dt>Relayer</dt>
              <dd className="mono">{trace.relayer.address}</dd>
            </>
          )}
        </dl>
      </section>

      <section className="section">
        <h2>Transaction Hashes</h2>
        <dl className="dl">
          <dt>Source Tx</dt>
          <dd className="mono">{trace.sourceTxHash}</dd>
          {trace.relayTxHash && (
            <>
              <dt>Relay Tx</dt>
              <dd className="mono">{trace.relayTxHash}</dd>
            </>
          )}
          {trace.destinationTxHash && (
            <>
              <dt>Destination Tx</dt>
              <dd className="mono">{trace.destinationTxHash}</dd>
            </>
          )}
        </dl>
      </section>

      {trace.fee && (
        <section className="section">
          <h2>Fee Info</h2>
          <dl className="dl">
            <dt>Token</dt>
            <dd className="mono">{trace.fee.feeTokenAddress}</dd>
            <dt>Initial</dt>
            <dd>{trace.fee.initialAmount}</dd>
            <dt>Added</dt>
            <dd>{trace.fee.addedAmount}</dd>
            <dt>Total</dt>
            <dd>{trace.fee.totalAmount}</dd>
          </dl>
        </section>
      )}

      {trace.retry && (
        <section className="section">
          <h2>Retry Info</h2>
          <dl className="dl">
            <dt>Original Gas Limit</dt>
            <dd>{trace.retry.originalGasLimit}</dd>
            <dt>Retry Gas Limit</dt>
            <dd>{trace.retry.retryGasLimit}</dd>
            <dt>Retry Tx</dt>
            <dd className="mono">{trace.retry.retryTxHash}</dd>
          </dl>
        </section>
      )}

      <section className="section">
        <h2>Event Timeline</h2>
        <div className="timeline">
          {trace.events.map((ev, i) => (
            <div key={i} className="timeline-item">
              <div className="timeline-dot" />
              <div className="timeline-content">
                <div className="timeline-header">
                  <EventBadge kind={ev.kind} />
                  <span className="muted timeline-time">
                    {fmt(ev.timestamp, "time")}
                  </span>
                </div>
                {ev.chain && (
                  <div className="timeline-meta">Chain: {ev.chain}</div>
                )}
                {ev.txHash && (
                  <div className="timeline-meta mono">
                    tx: {ev.txHash.slice(0, 20)}...
                  </div>
                )}
                {ev.blockNumber != null && (
                  <div className="timeline-meta">Block: {ev.blockNumber}</div>
                )}
                {ev.details && (
                  <div className="timeline-meta">{ev.details}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <h2>
          Raw JSON{" "}
          <button
            onClick={() => setShowRaw(!showRaw)}
            className="btn btn-sm"
          >
            {showRaw ? "Hide" : "Show"}
          </button>
        </h2>
        {showRaw && rawFetch.data && (
          <pre className="raw-json">
            {JSON.stringify(rawFetch.data, null, 2)}
          </pre>
        )}
        {showRaw && rawFetch.loading && <Loading label="Loading raw JSON..." />}
        {showRaw && rawFetch.error && <ErrorBox message={rawFetch.error} />}
      </section>
    </div>
  );
}
