import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { getChains, getTrace, getTraceRaw } from "../api.js";
import type { ChainRegistryEntry, MessageEvent, MessageTrace } from "../api.js";
import { useFetch, useFormatTime } from "../hooks.js";
import { ErrorBox } from "../components/ErrorBox.js";
import { EventTimeline } from "../components/EventTimeline.js";
import { ExpandableIdentifier } from "../components/ExpandableIdentifier.js";
import { Loading } from "../components/Loading.js";
import { StatusBadge } from "../components/StatusBadge.js";
import {
  findLatestFailureEvent,
  formatDurationMs,
  formatEventKind,
  getCurrentStateSummary,
  getTraceLatencyLabel,
} from "../trace-utils.js";

export function TraceDetailPage() {
  const { messageId } = useParams<{ messageId: string }>();
  const location = useLocation();
  const fmt = useFormatTime();
  const traceRequest = messageId
    ? () => getTrace(messageId)
    : () => Promise.reject(new Error("Trace ID is missing"));
  const rawTraceRequest = messageId
    ? () => getTraceRaw(messageId)
    : () => Promise.reject(new Error("Trace ID is missing"));

  const { data: trace, loading, error } = useFetch(traceRequest, [messageId]);
  const rawFetch = useFetch(rawTraceRequest, [messageId]);
  const chainsRes = useFetch(() => getChains());

  const [showRaw, setShowRaw] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [selectedEventIdx, setSelectedEventIdx] = useState<number | undefined>();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    setSelectedEventIdx(undefined);
  }, [messageId]);

  useEffect(() => {
    if (trace?.execution !== "pending") return;
    const id = window.setInterval(() => setRefreshTick((tick) => tick + 1), 5000);
    return () => window.clearInterval(id);
  }, [trace?.execution]);

  const { data: liveTrace } = useFetch(traceRequest, [messageId, refreshTick]);
  const displayTrace = liveTrace ?? trace;
  const selectedEvent =
    selectedEventIdx != null ? displayTrace?.events[selectedEventIdx] : undefined;
  const currentState = displayTrace ? getCurrentStateSummary(displayTrace, fmt) : null;
  const backTo = getReturnTo(location.state);

  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} />;
  if (!displayTrace) return <ErrorBox message="Trace not found" />;

  const selectedExplorerHref = selectedEvent
    ? getEventExplorerHref(displayTrace, selectedEvent, chainsRes.data?.chains ?? [])
    : undefined;
  const failureEvent = findLatestFailureEvent(displayTrace.events);

  async function copyValue(copyId: string, value: string) {
    if (!value || !navigator.clipboard?.writeText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(copyId);
      window.setTimeout(() => {
        setCopiedKey((current) => (current === copyId ? null : current));
      }, 1500);
    } catch {
      setCopiedKey(null);
    }
  }

  return (
    <div>
      <nav className="breadcrumb">
        <Link to={backTo}>&larr; Back to Traces</Link>
      </nav>

      <div className="trace-header">
        <h1>
          Trace Detail <StatusBadge status={displayTrace.execution} />
          {displayTrace.execution === "pending" && (
            <span className="live-dot" title="Auto-refreshing" />
          )}
        </h1>
      </div>

      {currentState && (
        <section className={`trace-state-card trace-state-${currentState.tone}`}>
          <div className="trace-state-label">Current state</div>
          <h2>{currentState.title}</h2>
          <p>{currentState.detail}</p>
          {failureEvent?.details && displayTrace.execution !== "pending" && (
            <p className="trace-state-note">Latest failure detail: {failureEvent.details}</p>
          )}
        </section>
      )}

      <div className="card-grid">
        <div className="card">
          <div className="card-label">Message ID</div>
          <ExpandableIdentifier value={displayTrace.messageId} className="card-value" />
          <QuickActions
            copyId="message-id"
            copyValue={displayTrace.messageId}
            copiedKey={copiedKey}
            onCopy={copyValue}
          />
        </div>
        <div className="card">
          <div className="card-label">Route</div>
          <div className="card-value trace-chain-flow">
            {displayTrace.source.name} <span className="arrow">&rarr;</span>{" "}
            {displayTrace.destination.name}
          </div>
          <div className="trace-route-meta">
            {displayTrace.source.blockchainId.slice(0, 10)}... →{" "}
            {displayTrace.destination.blockchainId.slice(0, 10)}...
          </div>
        </div>
        <div className="card">
          <div className="card-label">Latency</div>
          <div className="card-value">{getTraceLatencyLabel(displayTrace)}</div>
          <div className="trace-route-meta">Sent {fmt(displayTrace.timestamps.sendTime)}</div>
        </div>
        <div className="card">
          <div className="card-label">Events</div>
          <div className="card-value">{displayTrace.events.length}</div>
          <div className="trace-route-meta">
            Latest event:{" "}
            {formatEventKind(
              displayTrace.events[displayTrace.events.length - 1]?.kind ?? "unknown",
            )}
          </div>
        </div>
      </div>

      <section className="section">
        <h2>Addresses</h2>
        <dl className="dl">
          <dt>Sender</dt>
          <dd className="trace-detail-value">
            <ExpandableIdentifier value={displayTrace.sender} />
          </dd>
          <dt>Recipient</dt>
          <dd className="trace-detail-value">
            <ExpandableIdentifier value={displayTrace.recipient} />
          </dd>
          {displayTrace.relayer && (
            <>
              <dt>Relayer</dt>
              <dd className="trace-detail-value">
                <ExpandableIdentifier value={displayTrace.relayer.address} />
              </dd>
            </>
          )}
        </dl>
      </section>

      <section className="section">
        <h2>Transaction Hashes</h2>
        <dl className="dl">
          <dt>Source Tx</dt>
          <dd className="trace-detail-value">
            <ExpandableIdentifier value={displayTrace.sourceTxHash} />
            <QuickActions
              copyId="source-tx"
              copyValue={displayTrace.sourceTxHash}
              copiedKey={copiedKey}
              onCopy={copyValue}
              explorerHref={getTxExplorerHref(
                displayTrace.source.blockchainId,
                displayTrace.sourceTxHash,
                chainsRes.data?.chains ?? [],
              )}
            />
          </dd>
          {displayTrace.relayTxHash && (
            <>
              <dt>Relay Tx</dt>
              <dd className="trace-detail-value">
                <ExpandableIdentifier value={displayTrace.relayTxHash} />
                <QuickActions
                  copyId="relay-tx"
                  copyValue={displayTrace.relayTxHash}
                  copiedKey={copiedKey}
                  onCopy={copyValue}
                  explorerHref={getTxExplorerHref(
                    displayTrace.destination.blockchainId,
                    displayTrace.relayTxHash,
                    chainsRes.data?.chains ?? [],
                  )}
                />
              </dd>
            </>
          )}
          {displayTrace.destinationTxHash && (
            <>
              <dt>Destination Tx</dt>
              <dd className="trace-detail-value">
                <ExpandableIdentifier value={displayTrace.destinationTxHash} />
                <QuickActions
                  copyId="destination-tx"
                  copyValue={displayTrace.destinationTxHash}
                  copiedKey={copiedKey}
                  onCopy={copyValue}
                  explorerHref={getTxExplorerHref(
                    displayTrace.destination.blockchainId,
                    displayTrace.destinationTxHash,
                    chainsRes.data?.chains ?? [],
                  )}
                />
              </dd>
            </>
          )}
          {displayTrace.retry?.retryTxHash && (
            <>
              <dt>Retry Tx</dt>
              <dd className="trace-detail-value">
                <ExpandableIdentifier value={displayTrace.retry.retryTxHash} />
                <QuickActions
                  copyId="retry-tx"
                  copyValue={displayTrace.retry.retryTxHash}
                  copiedKey={copiedKey}
                  onCopy={copyValue}
                  explorerHref={getTxExplorerHref(
                    displayTrace.destination.blockchainId,
                    displayTrace.retry.retryTxHash,
                    chainsRes.data?.chains ?? [],
                  )}
                />
              </dd>
            </>
          )}
        </dl>
      </section>

      {displayTrace.fee && (
        <section className="section">
          <h2>Fee Info</h2>
          <dl className="dl">
            <dt>Token</dt>
            <dd className="trace-detail-value">
              <ExpandableIdentifier value={displayTrace.fee.feeTokenAddress} />
            </dd>
            <dt>Initial</dt>
            <dd className="trace-detail-value">{displayTrace.fee.initialAmount}</dd>
            <dt>Added</dt>
            <dd className="trace-detail-value">{displayTrace.fee.addedAmount}</dd>
            <dt>Total</dt>
            <dd className="trace-detail-value">{displayTrace.fee.totalAmount}</dd>
          </dl>
        </section>
      )}

      {displayTrace.retry && (
        <section className="section">
          <h2>Retry Info</h2>
          <dl className="dl">
            <dt>Original Gas Limit</dt>
            <dd className="trace-detail-value">{displayTrace.retry.originalGasLimit}</dd>
            <dt>Retry Gas Limit</dt>
            <dd className="trace-detail-value">{displayTrace.retry.retryGasLimit}</dd>
            <dt>Retry Outcome</dt>
            <dd className="trace-detail-value">
              Delivered after retry in {getTraceLatencyLabel(displayTrace)}
            </dd>
          </dl>
        </section>
      )}

      <section className="section">
        <h2>Lifecycle Timeline</h2>
        <EventTimeline
          events={displayTrace.events}
          selectedIndex={selectedEventIdx}
          onSelectEvent={(_event, index) => {
            setSelectedEventIdx((current) => (current === index ? undefined : index));
          }}
        />
      </section>

      {selectedEvent && (
        <div className="event-detail-panel">
          <h3>Event Details</h3>
          <dl className="dl">
            <dt>Kind</dt>
            <dd className="trace-detail-value">{formatEventKind(selectedEvent.kind)}</dd>
            <dt>Timestamp</dt>
            <dd className="trace-detail-value">{fmt(selectedEvent.timestamp)}</dd>
            {selectedEvent.chain && (
              <>
                <dt>Chain</dt>
                <dd className="trace-detail-value">{selectedEvent.chain}</dd>
              </>
            )}
            {selectedEvent.blockNumber != null && (
              <>
                <dt>Block Number</dt>
                <dd className="trace-detail-value">{selectedEvent.blockNumber.toLocaleString()}</dd>
              </>
            )}
            {selectedEvent.txHash && (
              <>
                <dt>Transaction Hash</dt>
                <dd className="trace-detail-value">
                  <ExpandableIdentifier value={selectedEvent.txHash} />
                  <QuickActions
                    copyId={`event-tx-${selectedEventIdx}`}
                    copyValue={selectedEvent.txHash}
                    copiedKey={copiedKey}
                    onCopy={copyValue}
                    explorerHref={selectedExplorerHref}
                  />
                </dd>
              </>
            )}
            {selectedEvent.details && (
              <>
                <dt>Details</dt>
                <dd className="trace-detail-value">{selectedEvent.details}</dd>
              </>
            )}
            <dt>Elapsed from send</dt>
            <dd className="trace-detail-value">
              {formatElapsedFromSend(displayTrace, selectedEvent)}
            </dd>
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

function QuickActions({
  copyId,
  copyValue,
  copiedKey,
  explorerHref,
  onCopy,
}: {
  copyId: string;
  copyValue: string;
  copiedKey: string | null;
  explorerHref?: string;
  onCopy: (copyId: string, value: string) => Promise<void>;
}) {
  return (
    <div className="trace-action-row">
      <button
        type="button"
        className="btn btn-sm trace-action-btn"
        onClick={() => onCopy(copyId, copyValue)}
      >
        {copiedKey === copyId ? "Copied" : "Copy"}
      </button>
      {explorerHref && (
        <a
          href={explorerHref}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-sm trace-action-link"
        >
          View on Explorer
        </a>
      )}
    </div>
  );
}

function getReturnTo(state: unknown): string {
  if (
    state &&
    typeof state === "object" &&
    "returnTo" in state &&
    typeof state.returnTo === "string"
  ) {
    return state.returnTo;
  }

  return "/traces";
}

function formatElapsedFromSend(trace: MessageTrace, event: MessageEvent): string {
  const sendMs = Date.parse(trace.timestamps.sendTime);
  const eventMs = Date.parse(event.timestamp);

  if (!Number.isFinite(sendMs) || !Number.isFinite(eventMs) || eventMs < sendMs) {
    return "—";
  }

  return formatDurationMs(eventMs - sendMs);
}

function getEventExplorerHref(
  trace: MessageTrace,
  event: MessageEvent,
  chains: ChainRegistryEntry[],
): string | undefined {
  if (!event.txHash) return undefined;
  const chainId = resolveEventChainId(trace, event);
  return chainId ? getTxExplorerHref(chainId, event.txHash, chains) : undefined;
}

function getTxExplorerHref(
  blockchainId: string,
  txHash: string,
  chains: ChainRegistryEntry[],
): string | undefined {
  const explorerUrl = chains.find((chain) => chain.blockchainId === blockchainId)?.explorerUrl;
  if (!explorerUrl) return undefined;
  return `${explorerUrl.replace(/\/$/, "")}/tx/${txHash}`;
}

function resolveEventChainId(trace: MessageTrace, event: MessageEvent): string | undefined {
  if (event.chain) {
    if (matchesChain(event.chain, trace.source, "source")) return trace.source.blockchainId;
    if (matchesChain(event.chain, trace.destination, "destination")) {
      return trace.destination.blockchainId;
    }
  }

  if (event.txHash === trace.sourceTxHash) return trace.source.blockchainId;
  if (
    event.txHash &&
    [
      trace.relayTxHash,
      trace.destinationTxHash,
      trace.retry?.retryTxHash,
      trace.relayer?.txHash,
    ].includes(event.txHash)
  ) {
    return trace.destination.blockchainId;
  }

  return undefined;
}

function matchesChain(
  chainValue: string,
  chain: MessageTrace["source"],
  role: "source" | "destination",
): boolean {
  const normalized = chainValue.toLowerCase();
  return (
    normalized === chain.name.toLowerCase() ||
    normalized === chain.blockchainId.toLowerCase() ||
    normalized === role
  );
}
