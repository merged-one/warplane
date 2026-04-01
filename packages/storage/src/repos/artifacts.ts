/**
 * Repository functions for artifact references.
 */

import type { Database } from "better-sqlite3";

export interface Artifact {
  id: number;
  type: string;
  path: string;
  description?: string;
  traceId?: number;
  importId?: number;
  createdAt: string;
}

export function upsertArtifact(
  db: Database,
  artifact: { type: string; path: string; description?: string; traceId?: number; importId?: number },
): number {
  const stmt = db.prepare(`
    INSERT INTO artifacts (type, path, description, trace_id, import_id)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(path) DO UPDATE SET
      type = excluded.type,
      description = excluded.description,
      trace_id = excluded.trace_id,
      import_id = excluded.import_id
    RETURNING id
  `);
  const row = stmt.get(
    artifact.type,
    artifact.path,
    artifact.description ?? null,
    artifact.traceId ?? null,
    artifact.importId ?? null,
  ) as { id: number };
  return row.id;
}

export function listArtifacts(
  db: Database,
  filter?: { type?: string; traceId?: number },
): Artifact[] {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filter?.type) {
    conditions.push("type = ?");
    params.push(filter.type);
  }
  if (filter?.traceId) {
    conditions.push("trace_id = ?");
    params.push(filter.traceId);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  return (
    db.prepare(`SELECT id, type, path, description, trace_id, import_id, created_at FROM artifacts ${where} ORDER BY created_at DESC`).all(...params) as Array<Record<string, unknown>>
  ).map((r) => ({
    id: r.id as number,
    type: r.type as string,
    path: r.path as string,
    description: (r.description as string) || undefined,
    traceId: (r.trace_id as number) || undefined,
    importId: (r.import_id as number) || undefined,
    createdAt: r.created_at as string,
  }));
}
