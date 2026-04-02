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
  type TraceFilter,
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
