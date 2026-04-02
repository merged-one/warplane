import type { ExecutionStatus } from "../api.js";

const STATUS_CLASSES: Record<ExecutionStatus, string> = {
  success: "badge-success",
  retry_success: "badge-retry",
  failed: "badge-failed",
  replay_blocked: "badge-blocked",
  pending: "badge-pending",
};

const STATUS_LABELS: Record<ExecutionStatus, string> = {
  success: "Success",
  retry_success: "Retry Success",
  failed: "Failed",
  replay_blocked: "Replay Blocked",
  pending: "Pending",
};

export function StatusBadge({ status }: { status: ExecutionStatus }) {
  return (
    <span className={`badge ${STATUS_CLASSES[status] ?? "badge-pending"}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
