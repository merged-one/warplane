/**
 * Checkpoint repository — persistent cursor tracking for RPC pollers.
 *
 * Follows the established repo pattern: functions take `db: Database` as
 * the first argument and use prepared statements with UPSERT semantics.
 */

import type { Database } from "../db.js";

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

export function upsertCheckpoint(db: Database, cp: Omit<Checkpoint, "updatedAt">): void {
  db.prepare(
    `INSERT INTO checkpoints (chain_id, contract_address, last_block, block_hash, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT (chain_id, contract_address)
     DO UPDATE SET last_block = excluded.last_block,
                   block_hash = excluded.block_hash,
                   updated_at = datetime('now')`,
  ).run(cp.chainId, cp.contractAddress, cp.lastBlock, cp.blockHash);
}

export function getCheckpoint(
  db: Database,
  chainId: string,
  contractAddress: string,
): Checkpoint | undefined {
  const row = db
    .prepare(
      `SELECT chain_id, contract_address, last_block, block_hash, updated_at
       FROM checkpoints
       WHERE chain_id = ? AND contract_address = ?`,
    )
    .get(chainId, contractAddress) as
    | {
        chain_id: string;
        contract_address: string;
        last_block: number;
        block_hash: string;
        updated_at: string;
      }
    | undefined;

  if (!row) return undefined;

  return {
    chainId: row.chain_id,
    contractAddress: row.contract_address,
    lastBlock: row.last_block,
    blockHash: row.block_hash,
    updatedAt: row.updated_at,
  };
}

export function deleteCheckpoint(db: Database, chainId: string, contractAddress: string): void {
  db.prepare(`DELETE FROM checkpoints WHERE chain_id = ? AND contract_address = ?`).run(
    chainId,
    contractAddress,
  );
}

export function listCheckpoints(db: Database): Checkpoint[] {
  const rows = db
    .prepare(
      `SELECT chain_id, contract_address, last_block, block_hash, updated_at
       FROM checkpoints
       ORDER BY chain_id`,
    )
    .all() as Array<{
    chain_id: string;
    contract_address: string;
    last_block: number;
    block_hash: string;
    updated_at: string;
  }>;

  return rows.map((row) => ({
    chainId: row.chain_id,
    contractAddress: row.contract_address,
    lastBlock: row.last_block,
    blockHash: row.block_hash,
    updatedAt: row.updated_at,
  }));
}
