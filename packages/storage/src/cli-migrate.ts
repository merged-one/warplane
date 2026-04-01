#!/usr/bin/env node
/**
 * CLI entry point for running migrations.
 * Usage: node --import tsx src/cli-migrate.ts [db-path]
 */

import { openDb, closeDb } from "./db.js";
import { runMigrations } from "./migrate.js";

const dbPath = process.argv[2] || "warplane.db";

console.log(`Running migrations on ${dbPath}...`);
const db = openDb({ path: dbPath });

try {
  const applied = runMigrations(db);
  if (applied.length === 0) {
    console.log("All migrations already applied.");
  } else {
    console.log(`Applied ${applied.length} migration(s):`);
    for (const name of applied) {
      console.log(`  ✓ ${name}`);
    }
  }
} finally {
  closeDb(db);
}
