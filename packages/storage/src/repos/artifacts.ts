/**
 * Repository functions for artifact references.
 *
 * Async, Postgres-native. Uses DatabaseAdapter interface.
 */

import type { DatabaseAdapter } from "../adapter.js";

export interface Artifact {
  id: number;
  type: string;
  path: string;
  description?: string;
  traceId?: number;
  importId?: number;
  createdAt: string;
}

export async function upsertArtifact(
  db: DatabaseAdapter,
  artifact: {
    type: string;
    path: string;
    description?: string;
    traceId?: number;
    importId?: number;
  },
): Promise<number> {
  const result = await db.query<{ id: number }>(
    `INSERT INTO artifacts (type, path, description, trace_id, import_id)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(path) DO UPDATE SET
       type = excluded.type,
       description = excluded.description,
       trace_id = excluded.trace_id,
       import_id = excluded.import_id
     RETURNING id`,
    [
      artifact.type,
      artifact.path,
      artifact.description ?? null,
      artifact.traceId ?? null,
      artifact.importId ?? null,
    ],
  );
  return result.rows[0]!.id;
}

export async function listArtifacts(
  db: DatabaseAdapter,
  filter?: { type?: string; traceId?: number },
): Promise<Artifact[]> {
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

  const result = await db.query<Record<string, unknown>>(
    `SELECT id, type, path, description, trace_id, import_id, created_at FROM artifacts ${where} ORDER BY created_at DESC`,
    params,
  );

  return result.rows.map((r) => ({
    id: r.id as number,
    type: r.type as string,
    path: r.path as string,
    description: (r.description as string) || undefined,
    traceId: (r.trace_id as number) || undefined,
    importId: (r.import_id as number) || undefined,
    createdAt: r.created_at as string,
  }));
}
