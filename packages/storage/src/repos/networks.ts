/**
 * Repository functions for network manifests.
 *
 * Async, Postgres-native. Uses DatabaseAdapter interface.
 */

import type { DatabaseAdapter } from "../adapter.js";
import type { NetworkManifest } from "@warplane/domain";

export async function upsertNetwork(
  db: DatabaseAdapter,
  manifest: NetworkManifest,
): Promise<number> {
  const result = await db.query<{ id: number }>(
    `INSERT INTO networks (network_id, network_dir, schema_version, teleporter_version, manifest_json)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(network_id) DO UPDATE SET
       network_dir = excluded.network_dir,
       schema_version = excluded.schema_version,
       teleporter_version = excluded.teleporter_version,
       manifest_json = excluded.manifest_json,
       updated_at = CURRENT_TIMESTAMP
     RETURNING id`,
    [
      manifest.networkId,
      manifest.networkDir ?? null,
      manifest.schemaVersion ?? "1.0.0",
      manifest.teleporterVersion ?? null,
      JSON.stringify(manifest),
    ],
  );
  return result.rows[0]!.id;
}

export async function getNetwork(
  db: DatabaseAdapter,
  networkId: number,
): Promise<NetworkManifest | undefined> {
  const result = await db.query<{ manifest_json: string }>(
    "SELECT manifest_json FROM networks WHERE network_id = ?",
    [networkId],
  );
  return result.rows[0] ? (JSON.parse(result.rows[0].manifest_json) as NetworkManifest) : undefined;
}

export async function listNetworks(db: DatabaseAdapter): Promise<NetworkManifest[]> {
  const result = await db.query<{ manifest_json: string }>(
    "SELECT manifest_json FROM networks ORDER BY network_id",
  );
  return result.rows.map((r) => JSON.parse(r.manifest_json) as NetworkManifest);
}
