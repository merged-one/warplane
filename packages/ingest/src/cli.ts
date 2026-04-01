#!/usr/bin/env node
/**
 * CLI entry point for artifact ingestion.
 *
 * Usage:
 *   node --import tsx src/cli.ts import <artifacts-dir> [--db <path>]
 *   node --import tsx src/cli.ts watch <artifacts-dir> [--db <path>] [--interval <ms>]
 */

import { openDb, closeDb, runMigrations } from "@warplane/storage";
import { importArtifacts } from "./importer.js";
import { startWatcher } from "./watcher.js";

const args = process.argv.slice(2);
const command = args[0];
const artifactsDir = args[1];

function getFlag(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : undefined;
}

const dbPath = getFlag("--db") ?? "warplane.db";

if (!command || !artifactsDir) {
  console.error("Usage:");
  console.error("  ingest import <artifacts-dir> [--db <path>]");
  console.error("  ingest watch  <artifacts-dir> [--db <path>] [--interval <ms>]");
  process.exit(1);
}

const db = openDb({ path: dbPath });
runMigrations(db);

if (command === "import") {
  const result = importArtifacts(db, { artifactsDir });
  closeDb(db);

  if (result.errors.length > 0) {
    console.error(`Completed with ${result.errors.length} error(s)`);
    process.exit(1);
  }
  process.exit(0);
} else if (command === "watch") {
  const intervalMs = Number(getFlag("--interval") ?? 5000);
  console.log(`Watching ${artifactsDir} every ${intervalMs}ms (db: ${dbPath})`);

  const { stop } = startWatcher(db, { artifactsDir, intervalMs });

  process.on("SIGINT", () => {
    stop();
    closeDb(db);
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    stop();
    closeDb(db);
    process.exit(0);
  });
} else {
  console.error(`Unknown command: ${command}`);
  process.exit(1);
}
