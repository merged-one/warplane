/**
 * Repository for signature aggregator health snapshots — append-only time-series.
 *
 * Uses the async DatabaseAdapter interface (ADR-0009).
 */

import type { DatabaseAdapter } from "../adapter.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SigAggHealthRow {
  id: number;
  status: "healthy" | "degraded" | "unhealthy";
  aggregationLatency: number | null;
  connectedStake: Record<string, number>;
  cacheHitRate: number | null;
  snapshotJson: string;
  createdAt: string;
}

export interface InsertSigAggHealth {
  status: "healthy" | "degraded" | "unhealthy";
  aggregationLatency?: number;
  connectedStake?: Record<string, number>;
  cacheHitRate?: number;
  snapshotJson: string;
}

// ---------------------------------------------------------------------------
// Repository functions
// ---------------------------------------------------------------------------

export async function insertSigAggHealth(
  db: DatabaseAdapter,
  row: InsertSigAggHealth,
): Promise<number> {
  const result = await db.query<{ id: number }>(
    `INSERT INTO sigagg_health (
      status, aggregation_latency, connected_stake_json, cache_hit_rate, snapshot_json
    ) VALUES (?, ?, ?, ?, ?)
    RETURNING id`,
    [
      row.status,
      row.aggregationLatency ?? null,
      row.connectedStake ? JSON.stringify(row.connectedStake) : null,
      row.cacheHitRate ?? null,
      row.snapshotJson,
    ],
  );
  return result.rows[0]!.id;
}

export async function getLatestSigAggHealth(
  db: DatabaseAdapter,
): Promise<SigAggHealthRow | undefined> {
  const result = await db.query<RawSigAggHealthRow>(
    `SELECT id, status, aggregation_latency, connected_stake_json,
            cache_hit_rate, snapshot_json, created_at
     FROM sigagg_health
     ORDER BY created_at DESC
     LIMIT 1`,
  );
  return result.rows[0] ? mapRow(result.rows[0]) : undefined;
}

export async function listSigAggHealthHistory(
  db: DatabaseAdapter,
  opts?: { limit?: number; since?: string },
): Promise<SigAggHealthRow[]> {
  const limit = opts?.limit ?? 100;
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (opts?.since) {
    conditions.push("created_at >= ?");
    params.push(opts.since);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  params.push(limit);

  const result = await db.query<RawSigAggHealthRow>(
    `SELECT id, status, aggregation_latency, connected_stake_json,
            cache_hit_rate, snapshot_json, created_at
     FROM sigagg_health
     ${where}
     ORDER BY created_at DESC
     LIMIT ?`,
    params,
  );
  return result.rows.map(mapRow);
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

interface RawSigAggHealthRow {
  id: number;
  status: "healthy" | "degraded" | "unhealthy";
  aggregation_latency: number | null;
  connected_stake_json: string | null;
  cache_hit_rate: number | null;
  snapshot_json: string;
  created_at: string;
}

function mapRow(row: RawSigAggHealthRow): SigAggHealthRow {
  return {
    id: row.id,
    status: row.status,
    aggregationLatency: row.aggregation_latency,
    connectedStake: row.connected_stake_json ? JSON.parse(row.connected_stake_json) : {},
    cacheHitRate: row.cache_hit_rate,
    snapshotJson: row.snapshot_json,
    createdAt: row.created_at,
  };
}
