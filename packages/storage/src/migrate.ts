/**
 * Schema initialization for Postgres.
 *
 * Reads the idempotent schema.sql and applies it via the DatabaseAdapter.
 * All statements use CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS,
 * so this is safe to call on every startup.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { DatabaseAdapter } from "./adapter.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Find the schema.sql file, checking both src and dist layouts.
 */
function getSchemaPath(): string {
  // In dev (vitest / ts-node): __dirname = packages/storage/src
  // In built dist: __dirname = packages/storage/dist
  const candidates = [
    path.join(__dirname, "..", "src", "schema.sql"),
    path.join(__dirname, "schema.sql"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error(`Cannot find schema.sql. Tried: ${candidates.join(", ")}`);
}

/**
 * Apply the Postgres schema to the database.
 *
 * Idempotent — safe to call on every app startup.
 */
export async function initSchema(adapter: DatabaseAdapter): Promise<void> {
  const schemaPath = getSchemaPath();
  const sql = fs.readFileSync(schemaPath, "utf-8");
  await adapter.exec(sql);
}
