/** Colored badge for event kinds, highlighting the key markers. */

const MARKER_KINDS = new Set([
  "fee_added",
  "execution_failed",
  "retry_succeeded",
  "receipts_sent",
  "replay_blocked",
]);

export function EventBadge({ kind }: { kind: string }) {
  const isMarker = MARKER_KINDS.has(kind);
  return (
    <span className={`event-badge${isMarker ? " event-badge-marker" : ""}`}>
      {kind.replace(/_/g, " ")}
    </span>
  );
}
