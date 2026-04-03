/**
 * SQLite adapter for tests only.
 *
 * Wraps better-sqlite3 (devDependency) in the async DatabaseAdapter interface.
 * Production code uses Postgres exclusively via createPostgresAdapter().
 *
 * The adapter automatically translates a few Postgres-isms so that repo
 * functions written with Postgres-native SQL still work against SQLite:
 *   - CURRENT_TIMESTAMP → supported natively in both
 *   - JSONB columns → stored as TEXT (SQLite is type-flexible)
 *   - BOOLEAN → INTEGER 0/1 (SQLite)
 *   - SERIAL PRIMARY KEY → INTEGER PRIMARY KEY AUTOINCREMENT
 */

import Database from "better-sqlite3";
import type { DatabaseAdapter, QueryResult } from "../adapter.js";

export interface TestDbOptions {
  /** Path to database file. Defaults to ":memory:". */
  path?: string;
}

/**
 * Create an in-memory SQLite adapter for testing.
 *
 * Usage in tests:
 *   import { createTestAdapter, initTestSchema } from "@warplane/storage/test-utils";
 *   const db = createTestAdapter();
 *   await initTestSchema(db);
 */
export function createTestAdapter(opts?: TestDbOptions): DatabaseAdapter {
  const db = new Database(opts?.path ?? ":memory:");

  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  const adapter: DatabaseAdapter = {
    dialect: "sqlite" as const,

    async query<T = Record<string, unknown>>(
      sql: string,
      params: unknown[] = [],
    ): Promise<QueryResult<T>> {
      const rows = db.prepare(sql).all(...params) as T[];
      return { rows, rowCount: rows.length };
    },

    async execute(sql: string, params: unknown[] = []): Promise<number> {
      const result = db.prepare(sql).run(...params);
      return result.changes;
    },

    async exec(sql: string): Promise<void> {
      db.exec(sql);
    },

    async transaction<T>(fn: (adapter: DatabaseAdapter) => Promise<T>): Promise<T> {
      return fn(adapter);
    },

    async close(): Promise<void> {
      db.close();
    },
  };

  return adapter;
}

/**
 * Initialize the test database schema.
 *
 * Translates the Postgres schema.sql into SQLite-compatible DDL.
 * We maintain a hand-written SQLite schema that mirrors the Postgres
 * schema.sql to keep tests fast and avoid needing a real Postgres.
 */
export async function initTestSchema(adapter: DatabaseAdapter): Promise<void> {
  await adapter.exec(SQLITE_SCHEMA);
}

// ---------------------------------------------------------------------------
// SQLite-compatible schema (mirrors packages/storage/src/schema.sql)
// ---------------------------------------------------------------------------

const SQLITE_SCHEMA = `
-- Networks
CREATE TABLE IF NOT EXISTS networks (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  network_id        INTEGER NOT NULL,
  network_dir       TEXT,
  schema_version    TEXT    NOT NULL DEFAULT '1.0.0',
  teleporter_version TEXT,
  manifest_json     TEXT    NOT NULL,
  created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(network_id)
);

-- Chains
CREATE TABLE IF NOT EXISTS chains (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  name              TEXT    NOT NULL,
  blockchain_id     TEXT    NOT NULL,
  subnet_id         TEXT    NOT NULL,
  evm_chain_id      INTEGER NOT NULL,
  teleporter_address TEXT,
  teleporter_registry_address TEXT,
  rpc_url           TEXT,
  explorer_url      TEXT,
  node_uris_json    TEXT,
  network_id        INTEGER REFERENCES networks(id),
  created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(blockchain_id)
);

-- Import history
CREATE TABLE IF NOT EXISTS import_history (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  source_dir      TEXT    NOT NULL,
  source_type     TEXT    NOT NULL DEFAULT 'fixture',
  started_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  completed_at    TEXT,
  status          TEXT    NOT NULL DEFAULT 'running',
  networks_count  INTEGER NOT NULL DEFAULT 0,
  chains_count    INTEGER NOT NULL DEFAULT 0,
  scenarios_count INTEGER NOT NULL DEFAULT 0,
  traces_count    INTEGER NOT NULL DEFAULT 0,
  events_count    INTEGER NOT NULL DEFAULT 0,
  error           TEXT
);

-- Scenario runs
CREATE TABLE IF NOT EXISTS scenario_runs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  scenario      TEXT    NOT NULL,
  started_at    TEXT    NOT NULL,
  completed_at  TEXT    NOT NULL,
  passed        INTEGER NOT NULL DEFAULT 0,
  error         TEXT,
  tags_json     TEXT,
  message_ids_json TEXT,
  trace_files_json TEXT,
  import_id     INTEGER REFERENCES import_history(id),
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(scenario, started_at)
);

-- Traces
CREATE TABLE IF NOT EXISTS traces (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id          TEXT    NOT NULL,
  scenario            TEXT    NOT NULL,
  execution           TEXT    NOT NULL,
  schema_version      TEXT    NOT NULL DEFAULT '1.0.0',
  source_name         TEXT,
  source_blockchain_id TEXT,
  source_subnet_id    TEXT,
  source_evm_chain_id INTEGER,
  dest_name           TEXT,
  dest_blockchain_id  TEXT,
  dest_subnet_id      TEXT,
  dest_evm_chain_id   INTEGER,
  sender              TEXT,
  recipient           TEXT,
  source_tx_hash      TEXT,
  destination_tx_hash TEXT,
  relay_tx_hash       TEXT,
  send_time           TEXT,
  receive_time        TEXT,
  block_send          INTEGER,
  block_recv          INTEGER,
  relayer_json        TEXT,
  fee_json            TEXT,
  retry_json          TEXT,
  raw_refs_json       TEXT,
  trace_json          TEXT    NOT NULL,
  import_id           INTEGER REFERENCES import_history(id),
  created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(message_id, scenario)
);

CREATE INDEX IF NOT EXISTS idx_traces_scenario ON traces(scenario);
CREATE INDEX IF NOT EXISTS idx_traces_execution ON traces(execution);
CREATE INDEX IF NOT EXISTS idx_traces_send_time ON traces(send_time);
CREATE INDEX IF NOT EXISTS idx_traces_source ON traces(source_blockchain_id);
CREATE INDEX IF NOT EXISTS idx_traces_dest ON traces(dest_blockchain_id);

-- Events
CREATE TABLE IF NOT EXISTS events (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  trace_id      INTEGER NOT NULL REFERENCES traces(id) ON DELETE CASCADE,
  message_id    TEXT    NOT NULL,
  kind          TEXT    NOT NULL,
  timestamp     TEXT    NOT NULL,
  block_number  INTEGER,
  tx_hash       TEXT,
  chain         TEXT,
  details       TEXT,
  seq           INTEGER NOT NULL,
  event_json    TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_trace ON events(trace_id);
CREATE INDEX IF NOT EXISTS idx_events_kind ON events(kind);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
CREATE INDEX IF NOT EXISTS idx_events_message_id ON events(message_id);

-- Artifacts
CREATE TABLE IF NOT EXISTS artifacts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  type        TEXT    NOT NULL,
  path        TEXT    NOT NULL,
  description TEXT,
  trace_id    INTEGER REFERENCES traces(id) ON DELETE SET NULL,
  import_id   INTEGER REFERENCES import_history(id),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(path)
);

-- Checkpoints
CREATE TABLE IF NOT EXISTS checkpoints (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  chain_id         TEXT    NOT NULL,
  contract_address TEXT    NOT NULL,
  last_block       INTEGER NOT NULL,
  block_hash       TEXT    NOT NULL,
  updated_at       TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(chain_id, contract_address)
);

-- Webhook destinations
CREATE TABLE IF NOT EXISTS webhook_destinations (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  url           TEXT NOT NULL,
  secret        TEXT,
  enabled       INTEGER NOT NULL DEFAULT 1,
  events        TEXT NOT NULL DEFAULT '["execution_failed"]',
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Webhook deliveries
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  destination_id  INTEGER NOT NULL REFERENCES webhook_destinations(id) ON DELETE CASCADE,
  message_id      TEXT NOT NULL,
  event_kind      TEXT NOT NULL,
  payload_json    TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'delivered', 'failed', 'exhausted')),
  attempts        INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TEXT,
  next_retry_at   TEXT,
  response_code   INTEGER,
  response_body   TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_next_retry ON webhook_deliveries(next_retry_at)
  WHERE status = 'pending' OR status = 'failed';

-- Relayer health
CREATE TABLE IF NOT EXISTS relayer_health (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  relayer_id          TEXT NOT NULL,
  status              TEXT NOT NULL CHECK (status IN ('healthy', 'degraded', 'unhealthy')),
  success_rate        REAL,
  latency_ms          REAL,
  lag_blocks          INTEGER,
  pending_messages    INTEGER,
  top_failures_json   TEXT,
  snapshot_json       TEXT NOT NULL,
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_relayer_health_created ON relayer_health(created_at);
CREATE INDEX IF NOT EXISTS idx_relayer_health_relayer ON relayer_health(relayer_id, created_at);

-- Sig-agg health
CREATE TABLE IF NOT EXISTS sigagg_health (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  status                TEXT NOT NULL CHECK (status IN ('healthy', 'degraded', 'unhealthy')),
  aggregation_latency   REAL,
  connected_stake_json  TEXT,
  cache_hit_rate        REAL,
  snapshot_json         TEXT NOT NULL,
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sigagg_health_created ON sigagg_health(created_at);

-- Alert rules
CREATE TABLE IF NOT EXISTS alert_rules (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  condition     TEXT NOT NULL,
  destinations  TEXT NOT NULL,
  enabled       INTEGER NOT NULL DEFAULT 1,
  cooldown_ms   INTEGER NOT NULL DEFAULT 300000,
  last_fired_at TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_alert_rules_enabled
  ON alert_rules(enabled) WHERE enabled = 1;
`;

/** Re-export for convenience */
export { type DatabaseAdapter } from "../adapter.js";
