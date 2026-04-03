/**
 * @warplane/storage — Local SQLite persistence layer.
 *
 * Provides typed repository functions for networks, chains, scenarios,
 * traces, events, artifacts, and import history backed by better-sqlite3.
 */

// Database lifecycle
export { openDb, closeDb, type DbOptions, type Database } from "./db.js";

// Migrations
export { runMigrations } from "./migrate.js";

// Repositories
export { upsertNetwork, getNetwork, listNetworks } from "./repos/networks.js";

export { upsertChain, getChain, listChains } from "./repos/chains.js";

export { upsertScenarioRun, getScenarioRun, listScenarioRuns } from "./repos/scenarios.js";

export {
  upsertTrace,
  getTrace,
  listTraces,
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

// Database adapter (async interface for new repos)
export { type DatabaseAdapter, type QueryResult } from "./adapter.js";
export { createSqliteAdapter } from "./sqlite-adapter.js";

// Health snapshot repositories (async, use DatabaseAdapter)
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

// Webhook repositories (async, use DatabaseAdapter)
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
  type WebhookDestination,
  type InsertWebhookDestination,
  type WebhookDelivery,
  type InsertWebhookDelivery,
  type DeliveryStatus,
} from "./repos/webhooks.js";
