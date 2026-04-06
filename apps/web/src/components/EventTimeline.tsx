/**
 * Enhanced vertical event timeline with on-chain vs off-chain distinction.
 */

import { useFormatTime } from "../hooks.js";
import { EventBadge } from "./EventBadge.js";
import type { MessageEvent } from "../api.js";

const OFF_CHAIN_KINDS = new Set([
  "warp_message_extracted",
  "signatures_aggregated",
  "relay_submitted",
]);

const SUCCESS_KINDS = new Set([
  "message_sent",
  "delivery_confirmed",
  "receipts_sent",
  "retry_succeeded",
]);

const FAILURE_KINDS = new Set(["execution_failed", "replay_blocked"]);

function getEventColor(kind: string): string {
  if (SUCCESS_KINDS.has(kind)) return "var(--green)";
  if (FAILURE_KINDS.has(kind)) return "var(--red)";
  if (kind === "fee_added") return "var(--orange)";
  return "var(--text-muted)";
}

export function EventTimeline({
  events,
  selectedIndex,
  onSelectEvent,
}: {
  events: MessageEvent[];
  selectedIndex?: number;
  onSelectEvent?: (event: MessageEvent, index: number) => void;
}) {
  const fmt = useFormatTime();

  if (events.length === 0) {
    return <div className="muted">No events recorded.</div>;
  }

  return (
    <div className="timeline enhanced-timeline">
      {events.map((ev, i) => {
        const isOffChain = OFF_CHAIN_KINDS.has(ev.kind);
        const isSelected = selectedIndex === i;
        const color = getEventColor(ev.kind);

        return (
          <div
            key={i}
            className={`timeline-item${isSelected ? " timeline-item-selected" : ""}`}
            onClick={() => onSelectEvent?.(ev, i)}
            role={onSelectEvent ? "button" : undefined}
            tabIndex={onSelectEvent ? 0 : undefined}
            aria-pressed={onSelectEvent ? isSelected : undefined}
            onKeyDown={(event) => {
              if (!onSelectEvent) return;
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelectEvent(ev, i);
              }
            }}
          >
            <div
              className={`timeline-dot ${isOffChain ? "timeline-dot-offchain" : "timeline-dot-onchain"}`}
              style={{ borderColor: color, background: isOffChain ? "transparent" : color }}
            />
            <div className="timeline-content">
              <div className="timeline-header">
                <EventBadge kind={ev.kind} />
                <span className="muted timeline-time">{fmt(ev.timestamp, "time")}</span>
                <span
                  className={`timeline-source-tag ${isOffChain ? "tag-offchain" : "tag-onchain"}`}
                >
                  {isOffChain ? "off-chain" : "on-chain"}
                </span>
              </div>
              {ev.chain && <div className="timeline-meta">Chain: {ev.chain}</div>}
              {ev.txHash && (
                <div className="timeline-meta mono">tx: {ev.txHash.slice(0, 20)}...</div>
              )}
              {ev.blockNumber != null && (
                <div className="timeline-meta">Block: {ev.blockNumber.toLocaleString()}</div>
              )}
              {ev.details && <div className="timeline-meta">{ev.details}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
