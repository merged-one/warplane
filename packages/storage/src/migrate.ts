/**
 * Simple file-based migration runner for SQLite.
 *
 * Reads SQL files from the migrations directory in sorted order,
 * applies any that haven't been run yet, and records them in the
 * `migrations` table.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Database } from "better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, "..", "src", "migrations");

/** Get the directory where migration SQL files live. */
function getMigrationsDir(): string {
  // In dev (ts-node, vitest) __dirname is packages/storage/src
  // In built dist __dirname is packages/storage/dist
  // We try src/migrations first, fall back to looking relative
  if (fs.existsSync(MIGRATIONS_DIR)) return MIGRATIONS_DIR;
  const altDir = path.join(__dirname, "migrations");
  if (fs.existsSync(altDir)) return altDir;
  throw new Error(`Cannot find migrations directory. Tried: ${MIGRATIONS_DIR}, ${altDir}`);
}

/**
 * Ensure the migrations tracking table exists.
 */
function ensureMigrationsTable(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id      INTEGER PRIMARY KEY,
      name    TEXT    NOT NULL UNIQUE,
      applied TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

/**
 * Run all pending migrations in order.
 * Returns the names of newly applied migrations.
 */
export function runMigrations(db: Database): string[] {
  ensureMigrationsTable(db);

  const migrationsDir = getMigrationsDir();
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const applied = new Set(
    (
      db.prepare("SELECT name FROM migrations").all() as Array<{ name: string }>
    ).map((r) => r.name),
  );

  const newlyApplied: string[] = [];

  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
    db.exec(sql);

    // Record migration (skip if the migration itself created the table row)
    const alreadyRecorded = db
      .prepare("SELECT 1 FROM migrations WHERE name = ?")
      .get(file);
    if (!alreadyRecorded) {
      db.prepare("INSERT INTO migrations (name) VALUES (?)").run(file);
    }

    newlyApplied.push(file);
  }

  return newlyApplied;
}
