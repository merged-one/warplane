/**
 * Repository for relayer health snapshots — append-only time-series.
 *
 * Uses the async DatabaseAdapter interface (ADR-0009).
 */

import type { DatabaseAdapter } from "../adapter.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RelayerHealthRow {
  id: number;
  relayerId: string;
  status: "healthy" | "degraded" | "unhealthy";
  successRate: number | null;
  latencyMs: number | null;
  lagBlocks: number | null;
  pendingMessages: number | null;
  topFailures: Array<{ reason: string; count: number }>;
  snapshotJson: string;
  createdAt: string;
}

export interface InsertRelayerHealth {
  relayerId: string;
  status: "healthy" | "degraded" | "unhealthy";
  successRate?: number;
  latencyMs?: number;
  lagBlocks?: number;
  pendingMessages?: number;
  topFailures?: Array<{ reason: string; count: number }>;
  snapshotJson: string;
}

// ---------------------------------------------------------------------------
// Repository functions
// ---------------------------------------------------------------------------

export async function insertRelayerHealth(
  db: DatabaseAdapter,
  row: InsertRelayerHealth,
): Promise<number> {
  const result = await db.query<{ id: number }>(
    `INSERT INTO relayer_health (
      relayer_id, status, success_rate, latency_ms, lag_blocks,
      pending_messages, top_failures_json, snapshot_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING id`,
    [
      row.relayerId,
      row.status,
      row.successRate ?? null,
      row.latencyMs ?? null,
      row.lagBlocks ?? null,
      row.pendingMessages ?? null,
      row.topFailures ? JSON.stringify(row.topFailures) : null,
      row.snapshotJson,
    ],
  );
  return result.rows[0]!.id;
}

export async function getLatestRelayerHealth(
  db: DatabaseAdapter,
  relayerId: string,
): Promise<RelayerHealthRow | undefined> {
  const result = await db.query<RawRelayerHealthRow>(
    `SELECT id, relayer_id, status, success_rate, latency_ms, lag_blocks,
            pending_messages, top_failures_json, snapshot_json, created_at
     FROM relayer_health
     WHERE relayer_id = ?
     ORDER BY created_at DESC
     LIMIT 1`,
    [relayerId],
  );
  return result.rows[0] ? mapRow(result.rows[0]) : undefined;
}

export async function listRelayerHealthHistory(
  db: DatabaseAdapter,
  relayerId: string,
  opts?: { limit?: number; since?: string },
): Promise<RelayerHealthRow[]> {
  const limit = opts?.limit ?? 100;
  const conditions = ["relayer_id = ?"];
  const params: unknown[] = [relayerId];

  if (opts?.since) {
    conditions.push("created_at >= ?");
    params.push(opts.since);
  }

  params.push(limit);

  const result = await db.query<RawRelayerHealthRow>(
    `SELECT id, relayer_id, status, success_rate, latency_ms, lag_blocks,
            pending_messages, top_failures_json, snapshot_json, created_at
     FROM relayer_health
     WHERE ${conditions.join(" AND ")}
     ORDER BY created_at DESC
     LIMIT ?`,
    params,
  );
  return result.rows.map(mapRow);
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

interface RawRelayerHealthRow {
  id: number;
  relayer_id: string;
  status: "healthy" | "degraded" | "unhealthy";
  success_rate: number | null;
  latency_ms: number | null;
  lag_blocks: number | null;
  pending_messages: number | null;
  top_failures_json: string | null;
  snapshot_json: string;
  created_at: string;
}

function mapRow(row: RawRelayerHealthRow): RelayerHealthRow {
  return {
    id: row.id,
    relayerId: row.relayer_id,
    status: row.status,
    successRate: row.success_rate,
    latencyMs: row.latency_ms,
    lagBlocks: row.lag_blocks,
    pendingMessages: row.pending_messages,
    topFailures: row.top_failures_json ? JSON.parse(row.top_failures_json) : [],
    snapshotJson: row.snapshot_json,
    createdAt: row.created_at,
  };
}
