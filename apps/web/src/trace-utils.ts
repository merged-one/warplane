import type { MessageEvent, MessageTrace } from "./api.js";

type FormatTime = (iso: string, style?: "datetime" | "time") => string;

export interface TraceStateSummary {
  title: string;
  detail: string;
  tone: "success" | "pending" | "failed" | "warning";
}

const FAILURE_EVENT_KINDS = new Set(["execution_failed", "replay_blocked"]);

export function formatEventKind(kind: string): string {
  return kind.replace(/_/g, " ");
}

export function formatDurationMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;

  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes < 60) {
    return `${minutes}m ${seconds}s`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

export function getTraceDurationMs(trace: Pick<MessageTrace, "timestamps">): number | null {
  const sendMs = Date.parse(trace.timestamps.sendTime);
  const receiveMs = Date.parse(trace.timestamps.receiveTime);

  if (!Number.isFinite(sendMs) || !Number.isFinite(receiveMs) || receiveMs <= sendMs) {
    return null;
  }

  return receiveMs - sendMs;
}

export function getTraceLatencyLabel(trace: Pick<MessageTrace, "timestamps">): string {
  const durationMs = getTraceDurationMs(trace);
  return durationMs == null ? "—" : formatDurationMs(durationMs);
}

export function getCurrentStateSummary(
  trace: MessageTrace,
  formatTime: FormatTime,
  nowMs = Date.now(),
): TraceStateSummary {
  if (trace.execution === "success") {
    return {
      title: "Delivered",
      detail: `Completed ${formatTime(trace.timestamps.receiveTime)} after ${getTraceLatencyLabel(trace)}.`,
      tone: "success",
    };
  }

  if (trace.execution === "retry_success") {
    const retryBits: string[] = [];
    if (trace.retry) {
      retryBits.push(
        `Retry gas ${trace.retry.retryGasLimit} (original ${trace.retry.originalGasLimit}).`,
      );
    }

    return {
      title: "Recovered after retry",
      detail: `Delivered ${formatTime(trace.timestamps.receiveTime)} after ${getTraceLatencyLabel(trace)}.${retryBits.length ? ` ${retryBits.join(" ")}` : ""}`,
      tone: "success",
    };
  }

  if (trace.execution === "pending") {
    const lastEvent = trace.events[trace.events.length - 1];
    const anchorTime = lastEvent?.timestamp ?? trace.timestamps.sendTime;
    const elapsedMs = Math.max(0, nowMs - Date.parse(anchorTime));
    const anchorLabel = lastEvent ? formatEventKind(lastEvent.kind) : "message sent";

    return {
      title: "In progress",
      detail: `Waiting after ${anchorLabel} for ${formatDurationMs(elapsedMs)}.`,
      tone: "pending",
    };
  }

  const failureEvent =
    findLatestFailureEvent(trace.events) ?? trace.events[trace.events.length - 1];
  const failureDetail = failureEvent?.details ? ` ${failureEvent.details}` : "";

  return {
    title:
      trace.execution === "replay_blocked" ? "Blocked by replay protection" : "Delivery failed",
    detail: failureEvent
      ? `Stopped at ${formatEventKind(failureEvent.kind)} on ${formatTime(failureEvent.timestamp)}.${failureDetail}`
      : "Trace stopped before a terminal event was recorded.",
    tone: trace.execution === "replay_blocked" ? "warning" : "failed",
  };
}

export function findLatestFailureEvent(events: MessageEvent[]): MessageEvent | undefined {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event && FAILURE_EVENT_KINDS.has(event.kind)) {
      return event;
    }
  }

  return undefined;
}
