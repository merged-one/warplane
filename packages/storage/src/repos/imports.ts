/**
 * Repository functions for import history tracking.
 */

import type { Database } from "better-sqlite3";

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

export function startImport(
  db: Database,
  sourceDir: string,
  sourceType: string = "fixture",
): number {
  const stmt = db.prepare(`
    INSERT INTO import_history (source_dir, source_type)
    VALUES (?, ?)
  `);
  return Number(stmt.run(sourceDir, sourceType).lastInsertRowid);
}

export function completeImport(
  db: Database,
  importId: number,
  counts: {
    networks: number;
    chains: number;
    scenarios: number;
    traces: number;
    events: number;
  },
): void {
  db.prepare(`
    UPDATE import_history SET
      status = 'completed',
      completed_at = datetime('now'),
      networks_count = ?,
      chains_count = ?,
      scenarios_count = ?,
      traces_count = ?,
      events_count = ?
    WHERE id = ?
  `).run(counts.networks, counts.chains, counts.scenarios, counts.traces, counts.events, importId);
}

export function failImport(db: Database, importId: number, error: string): void {
  db.prepare(`
    UPDATE import_history SET
      status = 'failed',
      completed_at = datetime('now'),
      error = ?
    WHERE id = ?
  `).run(error, importId);
}

export function getImport(db: Database, importId: number): ImportRecord | undefined {
  const row = db.prepare("SELECT * FROM import_history WHERE id = ?").get(importId) as Record<string, unknown> | undefined;
  if (!row) return undefined;
  return mapImportRow(row);
}

export function listImports(db: Database): ImportRecord[] {
  const rows = db.prepare("SELECT * FROM import_history ORDER BY started_at DESC").all() as Array<Record<string, unknown>>;
  return rows.map(mapImportRow);
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
