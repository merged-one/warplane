/**
 * @warplane/storage — Postgres-native persistence layer.
 *
 * Provides typed async repository functions backed by the DatabaseAdapter
 * interface. Production uses Postgres; tests use an in-memory SQLite adapter.
 */

// Database adapter
export { type DatabaseAdapter, type QueryResult } from "./adapter.js";
export { createPostgresAdapter, type PostgresAdapterConfig } from "./postgres-adapter.js";
export { initSchema } from "./migrate.js";

// Repositories — all async, all use DatabaseAdapter
export { upsertNetwork, getNetwork, listNetworks } from "./repos/networks.js";

export { upsertChain, getChain, listChains } from "./repos/chains.js";

export { upsertScenarioRun, getScenarioRun, listScenarioRuns } from "./repos/scenarios.js";

export {
  upsertTrace,
  getTrace,
  getTracesByMessageIds,
  listTraces,
  listTracesWithPlaceholderTimestamps,
  listTracesNeedingChainRepair,
  getTraceEvents,
  getTimeline,
  countTraces,
  getFailureClassification,
  getDeliveryLatencyStats,
  type TraceFilter,
  type FailureClassificationEntry,
  type LatencyStats,
} from "./repos/traces.js";

export { upsertArtifact, listArtifacts, type Artifact } from "./repos/artifacts.js";

export {
  startImport,
  completeImport,
  failImport,
  getImport,
  listImports,
  type ImportRecord,
} from "./repos/imports.js";

export {
  upsertCheckpoint,
  getCheckpoint,
  deleteCheckpoint,
  listCheckpoints,
  type Checkpoint,
} from "./repos/checkpoints.js";

// Health snapshot repositories
export {
  insertRelayerHealth,
  getLatestRelayerHealth,
  listRelayerHealthHistory,
  type RelayerHealthRow,
  type InsertRelayerHealth,
} from "./repos/relayer-health.js";

export {
  insertSigAggHealth,
  getLatestSigAggHealth,
  listSigAggHealthHistory,
  type SigAggHealthRow,
  type InsertSigAggHealth,
} from "./repos/sigagg-health.js";

// Webhook repositories
export {
  insertWebhookDestination,
  getWebhookDestination,
  listWebhookDestinations,
  updateWebhookDestination,
  deleteWebhookDestination,
  insertWebhookDelivery,
  markDeliveryStatus,
  getPendingDeliveries,
  getDeliveriesForMessage,
  getDeliveriesForDestination,
  type WebhookDestination,
  type InsertWebhookDestination,
  type WebhookDelivery,
  type InsertWebhookDelivery,
  type DeliveryStatus,
} from "./repos/webhooks.js";

// Alert rule repositories
export {
  insertAlertRule,
  getAlertRule,
  listAlertRules,
  updateAlertRule,
  deleteAlertRule,
  markAlertRuleFired,
  type AlertRule,
  type InsertAlertRule,
  type AlertCondition,
} from "./repos/alert-rules.js";
