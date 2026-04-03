/** Thin API client for the Warplane Control Plane API. */

const BASE = "/api/v1";

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status} ${text}`);
  }
  return res.json() as Promise<T>;
}

// ---- Types (keep lightweight; mirrors domain shapes) ----

export interface ChainMeta {
  name: string;
  blockchainId: string;
  subnetId: string;
  evmChainId: number;
}

export interface TraceTimestamps {
  sendTime: string;
  receiveTime: string;
  blockSend: number;
  blockRecv?: number;
}

export interface RelayerInfo {
  address: string;
  txHash: string;
}

export interface FeeInfo {
  feeTokenAddress: string;
  initialAmount: string;
  addedAmount: string;
  totalAmount: string;
}

export interface RetryInfo {
  originalGasLimit: string;
  retryGasLimit: string;
  retryTxHash: string;
}

export type ExecutionStatus = "success" | "retry_success" | "replay_blocked" | "failed" | "pending";

export interface MessageEvent {
  kind: string;
  timestamp: string;
  details?: string;
  blockNumber?: number;
  txHash?: string;
  chain?: string;
}

export interface MessageTrace {
  messageId: string;
  scenario: string;
  execution: ExecutionStatus;
  source: ChainMeta;
  destination: ChainMeta;
  sender: string;
  recipient: string;
  sourceTxHash: string;
  destinationTxHash?: string;
  relayTxHash?: string;
  timestamps: TraceTimestamps;
  events: MessageEvent[];
  relayer?: RelayerInfo;
  fee?: FeeInfo;
  retry?: RetryInfo;
  requiredGasLimit?: string;
  feeTokenAddress?: string;
  feeAmount?: string;
  relayerAddress?: string;
  receiptDelivered?: boolean;
  retryCount?: number;
  replayProtectionObserved?: boolean;
}

export interface ChainRegistryEntry {
  name: string;
  blockchainId: string;
  subnetId: string;
  evmChainId: number;
  rpcUrl?: string;
  explorerUrl?: string;
  teleporterAddress?: string;
}

export interface NetworkManifest {
  schemaVersion: string;
  networkId: string;
  source: ChainRegistryEntry;
  destination: ChainRegistryEntry;
  teleporterVersion?: string;
}

export interface ScenarioRun {
  scenario: string;
  startedAt: string;
  completedAt: string;
  passed: boolean;
  messageIds: string[];
  traceFiles: string[];
  error?: string;
  tags?: string[];
}

// ---- Health ----

export interface HealthResponse {
  status: string;
  uptime: number;
  traceCount: number;
}

export function getHealth(): Promise<HealthResponse> {
  return fetchJson("/health");
}

// ---- Chains ----

export function getChains(): Promise<{ chains: ChainRegistryEntry[] }> {
  return fetchJson(`${BASE}/chains`);
}

// ---- Network ----

export function getNetworks(): Promise<{ networks: NetworkManifest[] }> {
  return fetchJson(`${BASE}/network`);
}

// ---- Traces ----

export interface TracesParams {
  scenario?: string;
  status?: string;
  chain?: string;
  messageId?: string;
  page?: number;
  pageSize?: number;
}

export interface TracesResponse {
  traces: MessageTrace[];
  total: number;
  page: number;
  pageSize: number;
}

export function getTraces(params?: TracesParams): Promise<TracesResponse> {
  const qs = new URLSearchParams();
  if (params?.scenario) qs.set("scenario", params.scenario);
  if (params?.status) qs.set("status", params.status);
  if (params?.chain) qs.set("chain", params.chain);
  if (params?.messageId) qs.set("messageId", params.messageId);
  if (params?.page) qs.set("page", String(params.page));
  if (params?.pageSize) qs.set("pageSize", String(params.pageSize));
  const q = qs.toString();
  return fetchJson(`${BASE}/traces${q ? `?${q}` : ""}`);
}

export function getTrace(messageId: string): Promise<MessageTrace> {
  return fetchJson(`${BASE}/traces/${encodeURIComponent(messageId)}`);
}

export function getTraceTimeline(
  messageId: string,
): Promise<{ messageId: string; events: MessageEvent[] }> {
  return fetchJson(`${BASE}/traces/${encodeURIComponent(messageId)}/timeline`);
}

export function getTraceRaw(messageId: string): Promise<MessageTrace> {
  return fetchJson(`${BASE}/traces/${encodeURIComponent(messageId)}/raw`);
}

// ---- Failures ----

export function getFailures(params?: {
  scenario?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ failures: MessageTrace[] }> {
  const qs = new URLSearchParams();
  if (params?.scenario) qs.set("scenario", params.scenario);
  if (params?.page) qs.set("page", String(params.page));
  if (params?.pageSize) qs.set("pageSize", String(params.pageSize));
  const q = qs.toString();
  return fetchJson(`${BASE}/failures${q ? `?${q}` : ""}`);
}

// ---- Scenarios ----

export function getScenarios(): Promise<{ scenarios: ScenarioRun[] }> {
  return fetchJson(`${BASE}/scenarios`);
}

// ---- Search ----

export interface SearchResponse {
  query: string;
  traces: MessageTrace[];
  chains: ChainRegistryEntry[];
  scenarios: ScenarioRun[];
}

export function search(q: string, limit?: number): Promise<SearchResponse> {
  const qs = new URLSearchParams({ q });
  if (limit) qs.set("limit", String(limit));
  return fetchJson(`${BASE}/search?${qs}`);
}

// ---- Relayer Health ----

export type HealthStatus = "healthy" | "degraded" | "unhealthy";

export interface RelayerHealth {
  relayerId: string;
  status: HealthStatus;
  successRate: number | null;
  latencyMs: number | null;
  lagBlocks: number | null;
  pendingMessages: number | null;
  topFailures: Array<{ reason: string; count: number }>;
  createdAt: string;
}

export function getRelayerHealth(): Promise<{ health: RelayerHealth[] }> {
  return fetchJson(`${BASE}/relayer/health`);
}

export function getRelayerHealthHistory(relayerId?: string): Promise<{ history: RelayerHealth[] }> {
  const qs = new URLSearchParams();
  if (relayerId) qs.set("relayerId", relayerId);
  const q = qs.toString();
  return fetchJson(`${BASE}/relayer/health/history${q ? `?${q}` : ""}`);
}

// ---- Sig-Agg Health ----

export interface SigAggHealth {
  status: HealthStatus;
  aggregationLatency: number | null;
  connectedStake: Record<string, number>;
  cacheHitRate: number | null;
  createdAt: string;
}

export function getSigAggHealth(): Promise<{ health: SigAggHealth | null }> {
  return fetchJson(`${BASE}/sigagg/health`);
}

export function getSigAggHealthHistory(): Promise<{ history: SigAggHealth[] }> {
  return fetchJson(`${BASE}/sigagg/health/history`);
}

// ---- Stats ----

export interface FailureClassification {
  reason: string;
  count: number;
}

export function getFailureClassification(): Promise<{ failures: FailureClassification[] }> {
  return fetchJson(`${BASE}/stats/failures`);
}

export interface LatencyStats {
  p50: number;
  p90: number;
  p99: number;
  timeSeries: Array<{ time: string; latencyMs: number }>;
}

export function getLatencyStats(): Promise<LatencyStats> {
  return fetchJson(`${BASE}/stats/latency`);
}

// ---- Pipeline ----

export interface PipelineStatus {
  status: string;
  traceCount: number;
  uptime: number;
}

export function getPipelineStatus(): Promise<PipelineStatus> {
  return fetchJson(`${BASE}/pipeline/status`);
}
