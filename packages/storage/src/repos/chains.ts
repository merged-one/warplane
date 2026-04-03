/**
 * Repository functions for chain registry entries.
 *
 * Async, Postgres-native. Uses DatabaseAdapter interface.
 */

import type { DatabaseAdapter } from "../adapter.js";
import type { ChainRegistryEntry } from "@warplane/domain";

export async function upsertChain(
  db: DatabaseAdapter,
  chain: ChainRegistryEntry,
  networkDbId?: number,
): Promise<number> {
  const result = await db.query<{ id: number }>(
    `INSERT INTO chains (name, blockchain_id, subnet_id, evm_chain_id,
      teleporter_address, teleporter_registry_address, rpc_url, explorer_url,
      node_uris_json, network_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(blockchain_id) DO UPDATE SET
       name = excluded.name,
       subnet_id = excluded.subnet_id,
       evm_chain_id = excluded.evm_chain_id,
       teleporter_address = excluded.teleporter_address,
       teleporter_registry_address = excluded.teleporter_registry_address,
       rpc_url = excluded.rpc_url,
       explorer_url = excluded.explorer_url,
       node_uris_json = excluded.node_uris_json,
       network_id = excluded.network_id,
       updated_at = CURRENT_TIMESTAMP
     RETURNING id`,
    [
      chain.name,
      chain.blockchainId,
      chain.subnetId,
      chain.evmChainId,
      chain.teleporterAddress ?? null,
      chain.teleporterRegistryAddress ?? null,
      chain.rpcUrl ?? null,
      chain.explorerUrl ?? null,
      chain.nodeUris ? JSON.stringify(chain.nodeUris) : null,
      networkDbId ?? null,
    ],
  );
  return result.rows[0]!.id;
}

export async function getChain(
  db: DatabaseAdapter,
  blockchainId: string,
): Promise<ChainRegistryEntry | undefined> {
  const result = await db.query<Record<string, unknown>>(
    `SELECT name, blockchain_id, subnet_id, evm_chain_id,
            teleporter_address, teleporter_registry_address,
            rpc_url, explorer_url, node_uris_json
     FROM chains WHERE blockchain_id = ?`,
    [blockchainId],
  );

  const row = result.rows[0];
  if (!row) return undefined;

  return mapChainRow(row);
}

export async function listChains(db: DatabaseAdapter): Promise<ChainRegistryEntry[]> {
  const result = await db.query<Record<string, unknown>>(
    "SELECT name, blockchain_id, subnet_id, evm_chain_id, teleporter_address, teleporter_registry_address, rpc_url, explorer_url, node_uris_json FROM chains ORDER BY name",
  );
  return result.rows.map(mapChainRow);
}

function mapChainRow(row: Record<string, unknown>): ChainRegistryEntry {
  return {
    name: row.name as string,
    blockchainId: row.blockchain_id as string,
    subnetId: row.subnet_id as string,
    evmChainId: row.evm_chain_id as number,
    teleporterAddress: (row.teleporter_address as string) || undefined,
    teleporterRegistryAddress: (row.teleporter_registry_address as string) || undefined,
    rpcUrl: (row.rpc_url as string) || undefined,
    explorerUrl: (row.explorer_url as string) || undefined,
    nodeUris: row.node_uris_json ? JSON.parse(row.node_uris_json as string) : undefined,
  };
}
