/**
 * Database initialization and lifecycle management.
 *
 * Uses better-sqlite3 for synchronous, local SQLite access.
 * Databases are WAL-mode by default for better concurrent reads.
 */

import Database from "better-sqlite3";
import type { Database as DatabaseType } from "better-sqlite3";

export type { DatabaseType as Database };

export interface DbOptions {
  /** Path to the SQLite file. Use ":memory:" for in-memory databases. */
  path: string;
  /** Enable WAL journal mode (default: true). */
  wal?: boolean;
  /** Enable verbose logging (default: false). */
  verbose?: boolean;
}

/**
 * Open (or create) a SQLite database with sensible defaults.
 */
export function openDb(opts: DbOptions): DatabaseType {
  const db = new Database(opts.path, {
    verbose: opts.verbose ? console.log : undefined,
  });

  // Performance pragmas for local dev
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  db.pragma("synchronous = NORMAL");
  db.pragma("foreign_keys = ON");

  return db;
}

/**
 * Close the database cleanly.
 */
export function closeDb(db: DatabaseType): void {
  db.close();
}
