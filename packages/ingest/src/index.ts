/**
 * @warplane/ingest — Artifact ingestion pipeline.
 *
 * Imports harness artifacts (traces, network manifests, scenario runs)
 * into the @warplane/storage SQLite database with full domain validation.
 */

export { importArtifacts, type ImportResult, type ImportOptions } from "./importer.js";
export { startWatcher, type WatchOptions } from "./watcher.js";

// RPC ingestion engine
export * from "./rpc/index.js";
