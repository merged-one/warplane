-- Checkpoint tracking for RPC pollers.
-- Each chain+contract pair tracks the last fully processed block.

CREATE TABLE IF NOT EXISTS checkpoints (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  chain_id         TEXT    NOT NULL,
  contract_address TEXT    NOT NULL,
  last_block       INTEGER NOT NULL,
  block_hash       TEXT    NOT NULL,
  updated_at       TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(chain_id, contract_address)
);
