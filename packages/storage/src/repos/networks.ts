/**
 * Repository functions for network manifests.
 */

import type { Database } from "better-sqlite3";
import type { NetworkManifest } from "@warplane/domain";

export interface NetworkRow {
  id: number;
  network_id: number;
  network_dir: string | null;
  schema_version: string;
  teleporter_version: string | null;
  manifest_json: string;
  created_at: string;
  updated_at: string;
}

export function upsertNetwork(db: Database, manifest: NetworkManifest): number {
  const stmt = db.prepare(`
    INSERT INTO networks (network_id, network_dir, schema_version, teleporter_version, manifest_json)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(network_id) DO UPDATE SET
      network_dir = excluded.network_dir,
      schema_version = excluded.schema_version,
      teleporter_version = excluded.teleporter_version,
      manifest_json = excluded.manifest_json,
      updated_at = datetime('now')
    RETURNING id
  `);
  const row = stmt.get(
    manifest.networkId,
    manifest.networkDir ?? null,
    manifest.schemaVersion ?? "1.0.0",
    manifest.teleporterVersion ?? null,
    JSON.stringify(manifest),
  ) as { id: number };
  return row.id;
}

export function getNetwork(db: Database, networkId: number): NetworkManifest | undefined {
  const row = db
    .prepare("SELECT manifest_json FROM networks WHERE network_id = ?")
    .get(networkId) as { manifest_json: string } | undefined;
  return row ? (JSON.parse(row.manifest_json) as NetworkManifest) : undefined;
}

export function listNetworks(db: Database): NetworkManifest[] {
  const rows = db
    .prepare("SELECT manifest_json FROM networks ORDER BY network_id")
    .all() as Array<{ manifest_json: string }>;
  return rows.map((r) => JSON.parse(r.manifest_json) as NetworkManifest);
}
