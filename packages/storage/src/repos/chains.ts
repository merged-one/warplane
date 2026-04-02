/**
 * Repository functions for chain registry entries.
 */

import type { Database } from "better-sqlite3";
import type { ChainRegistryEntry } from "@warplane/domain";

export function upsertChain(db: Database, chain: ChainRegistryEntry, networkDbId?: number): number {
  const stmt = db.prepare(`
    INSERT INTO chains (name, blockchain_id, subnet_id, evm_chain_id,
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
      updated_at = datetime('now')
    RETURNING id
  `);
  const row = stmt.get(
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
  ) as { id: number };
  return row.id;
}

export function getChain(db: Database, blockchainId: string): ChainRegistryEntry | undefined {
  const row = db
    .prepare(
      `SELECT name, blockchain_id, subnet_id, evm_chain_id,
              teleporter_address, teleporter_registry_address,
              rpc_url, explorer_url, node_uris_json
       FROM chains WHERE blockchain_id = ?`,
    )
    .get(blockchainId) as Record<string, unknown> | undefined;

  if (!row) return undefined;

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

export function listChains(db: Database): ChainRegistryEntry[] {
  const rows = db
    .prepare(
      "SELECT name, blockchain_id, subnet_id, evm_chain_id, teleporter_address, teleporter_registry_address, rpc_url, explorer_url, node_uris_json FROM chains ORDER BY name",
    )
    .all() as Array<Record<string, unknown>>;
  return rows.map((row) => ({
    name: row.name as string,
    blockchainId: row.blockchain_id as string,
    subnetId: row.subnet_id as string,
    evmChainId: row.evm_chain_id as number,
    teleporterAddress: (row.teleporter_address as string) || undefined,
    teleporterRegistryAddress: (row.teleporter_registry_address as string) || undefined,
    rpcUrl: (row.rpc_url as string) || undefined,
    explorerUrl: (row.explorer_url as string) || undefined,
    nodeUris: row.node_uris_json ? JSON.parse(row.node_uris_json as string) : undefined,
  }));
}
