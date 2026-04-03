import type { HealthStatus } from "../api.js";

const STATUS_CLASSES: Record<HealthStatus, string> = {
  healthy: "health-healthy",
  degraded: "health-degraded",
  unhealthy: "health-unhealthy",
};

const STATUS_LABELS: Record<HealthStatus, string> = {
  healthy: "Healthy",
  degraded: "Degraded",
  unhealthy: "Unhealthy",
};

export function HealthBadge({ status }: { status: HealthStatus }) {
  return (
    <span className={`badge health-badge ${STATUS_CLASSES[status] ?? "health-degraded"}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
