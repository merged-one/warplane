import type { ExecutionStatus, TracesParams } from "../api.js";

export interface TraceQueryState {
  scenario: string;
  status: ExecutionStatus | "";
  sourceBlockchainId: string;
  destinationBlockchainId: string;
  legacyChain: string;
  messageId: string;
  page: number;
}

export interface TraceDraftFilters {
  scenario: string;
  sourceBlockchainId: string;
  destinationBlockchainId: string;
  legacyChain: string;
  messageId: string;
}

const VALID_STATUSES = new Set<TraceQueryState["status"]>([
  "",
  "pending",
  "success",
  "failed",
  "retry_success",
  "replay_blocked",
]);

export function getTraceQuery(searchParams: URLSearchParams): TraceQueryState {
  const statusParam = searchParams.get("status") ?? "";
  const pageParam = Number.parseInt(searchParams.get("page") ?? "1", 10);

  return {
    scenario: searchParams.get("scenario") ?? "",
    status: VALID_STATUSES.has(statusParam as TraceQueryState["status"])
      ? (statusParam as TraceQueryState["status"])
      : "",
    sourceBlockchainId: searchParams.get("sourceBlockchainId") ?? "",
    destinationBlockchainId: searchParams.get("destinationBlockchainId") ?? "",
    legacyChain: searchParams.get("chain") ?? "",
    messageId: searchParams.get("messageId") ?? "",
    page: Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1,
  };
}

export function createTraceDraftFromQuery(query: TraceQueryState): TraceDraftFilters {
  return {
    scenario: query.scenario,
    sourceBlockchainId: query.sourceBlockchainId,
    destinationBlockchainId: query.destinationBlockchainId,
    legacyChain: query.legacyChain,
    messageId: query.messageId,
  };
}

export function createEmptyTraceDraft(): TraceDraftFilters {
  return {
    scenario: "",
    sourceBlockchainId: "",
    destinationBlockchainId: "",
    legacyChain: "",
    messageId: "",
  };
}

export function applyTraceDraft(query: TraceQueryState, draft: TraceDraftFilters): TraceQueryState {
  const nextQuery: TraceQueryState = {
    ...query,
    page: 1,
    scenario: draft.scenario,
    sourceBlockchainId: draft.sourceBlockchainId,
    destinationBlockchainId: draft.destinationBlockchainId,
    legacyChain: draft.legacyChain,
    messageId: draft.messageId.trim(),
  };

  if (nextQuery.sourceBlockchainId || nextQuery.destinationBlockchainId) {
    nextQuery.legacyChain = "";
  }

  return nextQuery;
}

export function patchTraceQuery(
  query: TraceQueryState,
  patch: Partial<TraceQueryState>,
): TraceQueryState {
  const nextQuery: TraceQueryState = {
    ...query,
    ...patch,
  };

  if (
    patch.status !== undefined ||
    patch.scenario !== undefined ||
    patch.sourceBlockchainId !== undefined ||
    patch.destinationBlockchainId !== undefined ||
    patch.legacyChain !== undefined ||
    patch.messageId !== undefined
  ) {
    nextQuery.page = 1;
  }

  if (nextQuery.sourceBlockchainId || nextQuery.destinationBlockchainId) {
    nextQuery.legacyChain = "";
  }

  if (!Number.isFinite(nextQuery.page) || nextQuery.page < 1) {
    nextQuery.page = 1;
  }

  return nextQuery;
}

export function serializeTraceQuery(query: TraceQueryState): URLSearchParams {
  const next = new URLSearchParams();

  if (query.scenario) next.set("scenario", query.scenario);
  if (query.status) next.set("status", query.status);
  if (query.sourceBlockchainId) next.set("sourceBlockchainId", query.sourceBlockchainId);
  if (query.destinationBlockchainId) {
    next.set("destinationBlockchainId", query.destinationBlockchainId);
  }
  if (!query.sourceBlockchainId && !query.destinationBlockchainId && query.legacyChain) {
    next.set("chain", query.legacyChain);
  }
  if (query.messageId) next.set("messageId", query.messageId.trim());
  if (query.page > 1) next.set("page", String(query.page));

  return next;
}

export function createTracesParams(query: TraceQueryState): TracesParams {
  return {
    scenario: query.scenario || undefined,
    status: query.status || undefined,
    chain:
      !query.sourceBlockchainId && !query.destinationBlockchainId
        ? query.legacyChain || undefined
        : undefined,
    sourceBlockchainId: query.sourceBlockchainId || undefined,
    destinationBlockchainId: query.destinationBlockchainId || undefined,
    messageId: query.messageId || undefined,
    sort: "newest",
    page: query.page,
  };
}

export function countActiveTraceFilters(query: TraceQueryState): number {
  return [
    query.scenario,
    query.status,
    query.sourceBlockchainId,
    query.destinationBlockchainId,
    query.legacyChain,
    query.messageId,
  ].filter(Boolean).length;
}

export function areTraceDraftFiltersEqual(
  draft: TraceDraftFilters,
  query: TraceQueryState,
): boolean {
  return (
    draft.scenario === query.scenario &&
    draft.sourceBlockchainId === query.sourceBlockchainId &&
    draft.destinationBlockchainId === query.destinationBlockchainId &&
    draft.legacyChain === query.legacyChain &&
    draft.messageId.trim() === query.messageId
  );
}
