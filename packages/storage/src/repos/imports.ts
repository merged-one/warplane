/**
 * Repository functions for import history tracking.
 *
 * Async, Postgres-native. Uses DatabaseAdapter interface.
 */

import type { DatabaseAdapter } from "../adapter.js";

export interface ImportRecord {
  id: number;
  sourceDir: string;
  sourceType: string;
  startedAt: string;
  completedAt: string | null;
  status: string;
  networksCount: number;
  chainsCount: number;
  scenariosCount: number;
  tracesCount: number;
  eventsCount: number;
  error: string | null;
}

export async function startImport(
  db: DatabaseAdapter,
  sourceDir: string,
  sourceType: string = "fixture",
): Promise<number> {
  const result = await db.query<{ id: number }>(
    `INSERT INTO import_history (source_dir, source_type) VALUES (?, ?) RETURNING id`,
    [sourceDir, sourceType],
  );
  return result.rows[0]!.id;
}

export async function completeImport(
  db: DatabaseAdapter,
  importId: number,
  counts: {
    networks: number;
    chains: number;
    scenarios: number;
    traces: number;
    events: number;
  },
): Promise<void> {
  await db.execute(
    `UPDATE import_history SET
      status = 'completed',
      completed_at = CURRENT_TIMESTAMP,
      networks_count = ?,
      chains_count = ?,
      scenarios_count = ?,
      traces_count = ?,
      events_count = ?
    WHERE id = ?`,
    [counts.networks, counts.chains, counts.scenarios, counts.traces, counts.events, importId],
  );
}

export async function failImport(
  db: DatabaseAdapter,
  importId: number,
  error: string,
): Promise<void> {
  await db.execute(
    `UPDATE import_history SET
      status = 'failed',
      completed_at = CURRENT_TIMESTAMP,
      error = ?
    WHERE id = ?`,
    [error, importId],
  );
}

export async function getImport(
  db: DatabaseAdapter,
  importId: number,
): Promise<ImportRecord | undefined> {
  const result = await db.query<Record<string, unknown>>(
    "SELECT * FROM import_history WHERE id = ?",
    [importId],
  );
  const row = result.rows[0];
  if (!row) return undefined;
  return mapImportRow(row);
}

export async function listImports(db: DatabaseAdapter): Promise<ImportRecord[]> {
  const result = await db.query<Record<string, unknown>>(
    "SELECT * FROM import_history ORDER BY started_at DESC",
  );
  return result.rows.map(mapImportRow);
}

function mapImportRow(row: Record<string, unknown>): ImportRecord {
  return {
    id: row.id as number,
    sourceDir: row.source_dir as string,
    sourceType: row.source_type as string,
    startedAt: row.started_at as string,
    completedAt: (row.completed_at as string) || null,
    status: row.status as string,
    networksCount: row.networks_count as number,
    chainsCount: row.chains_count as number,
    scenariosCount: row.scenarios_count as number,
    tracesCount: row.traces_count as number,
    eventsCount: row.events_count as number,
    error: (row.error as string) || null,
  };
}
