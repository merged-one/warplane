-- 001_initial.sql — Warplane storage schema
-- Covers networks, chains, scenarios, traces, events, artifacts, and import history.

CREATE TABLE IF NOT EXISTS migrations (
  id        INTEGER PRIMARY KEY,
  name      TEXT    NOT NULL UNIQUE,
  applied   TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------------
-- Networks
-- ---------------------------------------------------------------------------

CREATE TABLE networks (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  network_id        INTEGER NOT NULL,
  network_dir       TEXT,
  schema_version    TEXT    NOT NULL DEFAULT '1.0.0',
  teleporter_version TEXT,
  -- Store full source/destination chain info and extras as JSON
  manifest_json     TEXT    NOT NULL,
  created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(network_id)
);

-- ---------------------------------------------------------------------------
-- Chains (registry entries)
-- ---------------------------------------------------------------------------

CREATE TABLE chains (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  name              TEXT    NOT NULL,
  blockchain_id     TEXT    NOT NULL,
  subnet_id         TEXT    NOT NULL,
  evm_chain_id      INTEGER NOT NULL,
  teleporter_address TEXT,
  teleporter_registry_address TEXT,
  rpc_url           TEXT,
  explorer_url      TEXT,
  node_uris_json    TEXT,   -- JSON array of strings
  network_id        INTEGER REFERENCES networks(id),
  created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(blockchain_id)
);

-- ---------------------------------------------------------------------------
-- Scenario runs
-- ---------------------------------------------------------------------------

CREATE TABLE scenario_runs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  scenario      TEXT    NOT NULL,
  started_at    TEXT    NOT NULL,
  completed_at  TEXT    NOT NULL,
  passed        INTEGER NOT NULL DEFAULT 0,  -- boolean
  error         TEXT,
  tags_json     TEXT,    -- JSON array of strings
  message_ids_json TEXT, -- JSON array of strings
  trace_files_json TEXT, -- JSON array of strings
  import_id     INTEGER REFERENCES import_history(id),
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(scenario, started_at)
);

-- ---------------------------------------------------------------------------
-- Traces (message traces)
-- ---------------------------------------------------------------------------

CREATE TABLE traces (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id          TEXT    NOT NULL,
  scenario            TEXT    NOT NULL,
  execution           TEXT    NOT NULL, -- ExecutionStatus enum
  schema_version      TEXT    NOT NULL DEFAULT '1.0.0',
  -- Source chain
  source_name         TEXT,
  source_blockchain_id TEXT,
  source_subnet_id    TEXT,
  source_evm_chain_id INTEGER,
  -- Destination chain
  dest_name           TEXT,
  dest_blockchain_id  TEXT,
  dest_subnet_id      TEXT,
  dest_evm_chain_id   INTEGER,
  -- Participants
  sender              TEXT,
  recipient           TEXT,
  -- Tx hashes
  source_tx_hash      TEXT,
  destination_tx_hash TEXT,
  relay_tx_hash       TEXT,
  -- Timestamps
  send_time           TEXT,
  receive_time        TEXT,
  block_send          INTEGER,
  block_recv          INTEGER,
  -- Complex nested data as JSON
  relayer_json        TEXT,
  fee_json            TEXT,
  retry_json          TEXT,
  raw_refs_json       TEXT,
  -- Full trace for reconstruction
  trace_json          TEXT    NOT NULL,
  import_id           INTEGER REFERENCES import_history(id),
  created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(message_id, scenario)
);

CREATE INDEX idx_traces_scenario ON traces(scenario);
CREATE INDEX idx_traces_execution ON traces(execution);
CREATE INDEX idx_traces_send_time ON traces(send_time);
CREATE INDEX idx_traces_source ON traces(source_blockchain_id);
CREATE INDEX idx_traces_dest ON traces(dest_blockchain_id);

-- ---------------------------------------------------------------------------
-- Events (timeline events, denormalized for ordered queries)
-- ---------------------------------------------------------------------------

CREATE TABLE events (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  trace_id      INTEGER NOT NULL REFERENCES traces(id) ON DELETE CASCADE,
  message_id    TEXT    NOT NULL,
  kind          TEXT    NOT NULL,
  timestamp     TEXT    NOT NULL,
  block_number  INTEGER,
  tx_hash       TEXT,
  chain         TEXT,
  details       TEXT,
  seq           INTEGER NOT NULL, -- ordering within the trace
  event_json    TEXT    NOT NULL  -- full event payload
);

CREATE INDEX idx_events_trace ON events(trace_id);
CREATE INDEX idx_events_kind ON events(kind);
CREATE INDEX idx_events_timestamp ON events(timestamp);
CREATE INDEX idx_events_message_id ON events(message_id);

-- ---------------------------------------------------------------------------
-- Artifacts (raw file references)
-- ---------------------------------------------------------------------------

CREATE TABLE artifacts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  type        TEXT    NOT NULL, -- trace, scenario_run, network_manifest, log, other
  path        TEXT    NOT NULL,
  description TEXT,
  trace_id    INTEGER REFERENCES traces(id) ON DELETE SET NULL,
  import_id   INTEGER REFERENCES import_history(id),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(path)
);

-- ---------------------------------------------------------------------------
-- Import history (idempotent tracking)
-- ---------------------------------------------------------------------------

CREATE TABLE import_history (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  source_dir      TEXT    NOT NULL,
  source_type     TEXT    NOT NULL DEFAULT 'fixture', -- fixture, live, manual
  started_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  completed_at    TEXT,
  status          TEXT    NOT NULL DEFAULT 'running', -- running, completed, failed
  networks_count  INTEGER NOT NULL DEFAULT 0,
  chains_count    INTEGER NOT NULL DEFAULT 0,
  scenarios_count INTEGER NOT NULL DEFAULT 0,
  traces_count    INTEGER NOT NULL DEFAULT 0,
  events_count    INTEGER NOT NULL DEFAULT 0,
  error           TEXT
);
