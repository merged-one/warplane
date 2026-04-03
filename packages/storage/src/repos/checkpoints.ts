/**
 * Checkpoint repository — persistent cursor tracking for RPC pollers.
 *
 * Async, Postgres-native. Uses DatabaseAdapter interface.
 */

import type { DatabaseAdapter } from "../adapter.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Checkpoint {
  chainId: string;
  contractAddress: string;
  lastBlock: number;
  blockHash: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Repository functions
// ---------------------------------------------------------------------------

export async function upsertCheckpoint(
  db: DatabaseAdapter,
  cp: Omit<Checkpoint, "updatedAt">,
): Promise<void> {
  await db.execute(
    `INSERT INTO checkpoints (chain_id, contract_address, last_block, block_hash, updated_at)
     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT (chain_id, contract_address)
     DO UPDATE SET last_block = excluded.last_block,
                   block_hash = excluded.block_hash,
                   updated_at = CURRENT_TIMESTAMP`,
    [cp.chainId, cp.contractAddress, cp.lastBlock, cp.blockHash],
  );
}

export async function getCheckpoint(
  db: DatabaseAdapter,
  chainId: string,
  contractAddress: string,
): Promise<Checkpoint | undefined> {
  const result = await db.query<{
    chain_id: string;
    contract_address: string;
    last_block: number;
    block_hash: string;
    updated_at: string;
  }>(
    `SELECT chain_id, contract_address, last_block, block_hash, updated_at
     FROM checkpoints
     WHERE chain_id = ? AND contract_address = ?`,
    [chainId, contractAddress],
  );

  const row = result.rows[0];
  if (!row) return undefined;

  return {
    chainId: row.chain_id,
    contractAddress: row.contract_address,
    lastBlock: row.last_block,
    blockHash: row.block_hash,
    updatedAt: row.updated_at,
  };
}

export async function deleteCheckpoint(
  db: DatabaseAdapter,
  chainId: string,
  contractAddress: string,
): Promise<void> {
  await db.execute(`DELETE FROM checkpoints WHERE chain_id = ? AND contract_address = ?`, [
    chainId,
    contractAddress,
  ]);
}

export async function listCheckpoints(db: DatabaseAdapter): Promise<Checkpoint[]> {
  const result = await db.query<{
    chain_id: string;
    contract_address: string;
    last_block: number;
    block_hash: string;
    updated_at: string;
  }>(
    `SELECT chain_id, contract_address, last_block, block_hash, updated_at
     FROM checkpoints
     ORDER BY chain_id`,
  );

  return result.rows.map((row) => ({
    chainId: row.chain_id,
    contractAddress: row.contract_address,
    lastBlock: row.last_block,
    blockHash: row.block_hash,
    updatedAt: row.updated_at,
  }));
}
