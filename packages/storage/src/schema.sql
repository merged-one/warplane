-- Warplane Postgres Schema
-- Complete DDL for all tables. Idempotent (CREATE TABLE IF NOT EXISTS).

-- ---------------------------------------------------------------------------
-- Networks
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS networks (
  id                SERIAL PRIMARY KEY,
  network_id        INTEGER NOT NULL,
  network_dir       TEXT,
  schema_version    TEXT    NOT NULL DEFAULT '1.0.0',
  teleporter_version TEXT,
  manifest_json     JSONB   NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(network_id)
);

-- ---------------------------------------------------------------------------
-- Chains (registry entries)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS chains (
  id                SERIAL PRIMARY KEY,
  name              TEXT    NOT NULL,
  blockchain_id     TEXT    NOT NULL,
  subnet_id         TEXT    NOT NULL,
  evm_chain_id      INTEGER NOT NULL,
  teleporter_address TEXT,
  teleporter_registry_address TEXT,
  rpc_url           TEXT,
  explorer_url      TEXT,
  node_uris_json    JSONB,
  network_id        INTEGER REFERENCES networks(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(blockchain_id)
);

-- ---------------------------------------------------------------------------
-- Import history (idempotent tracking)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS import_history (
  id              SERIAL PRIMARY KEY,
  source_dir      TEXT    NOT NULL,
  source_type     TEXT    NOT NULL DEFAULT 'fixture',
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  status          TEXT    NOT NULL DEFAULT 'running',
  networks_count  INTEGER NOT NULL DEFAULT 0,
  chains_count    INTEGER NOT NULL DEFAULT 0,
  scenarios_count INTEGER NOT NULL DEFAULT 0,
  traces_count    INTEGER NOT NULL DEFAULT 0,
  events_count    INTEGER NOT NULL DEFAULT 0,
  error           TEXT
);

-- ---------------------------------------------------------------------------
-- Scenario runs
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS scenario_runs (
  id            SERIAL PRIMARY KEY,
  scenario      TEXT    NOT NULL,
  started_at    TEXT    NOT NULL,
  completed_at  TEXT    NOT NULL,
  passed        BOOLEAN NOT NULL DEFAULT FALSE,
  error         TEXT,
  tags_json     JSONB,
  message_ids_json JSONB,
  trace_files_json JSONB,
  import_id     INTEGER REFERENCES import_history(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(scenario, started_at)
);

-- ---------------------------------------------------------------------------
-- Traces (message traces)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS traces (
  id                  SERIAL PRIMARY KEY,
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
  relayer_json        JSONB,
  fee_json            JSONB,
  retry_json          JSONB,
  raw_refs_json       JSONB,
  trace_json          JSONB   NOT NULL,
  import_id           INTEGER REFERENCES import_history(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(message_id, scenario)
);

CREATE INDEX IF NOT EXISTS idx_traces_scenario ON traces(scenario);
CREATE INDEX IF NOT EXISTS idx_traces_execution ON traces(execution);
CREATE INDEX IF NOT EXISTS idx_traces_send_time ON traces(send_time);
CREATE INDEX IF NOT EXISTS idx_traces_source ON traces(source_blockchain_id);
CREATE INDEX IF NOT EXISTS idx_traces_dest ON traces(dest_blockchain_id);

-- ---------------------------------------------------------------------------
-- Events (timeline events, denormalized for ordered queries)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS events (
  id            SERIAL PRIMARY KEY,
  trace_id      INTEGER NOT NULL REFERENCES traces(id) ON DELETE CASCADE,
  message_id    TEXT    NOT NULL,
  kind          TEXT    NOT NULL,
  timestamp     TEXT    NOT NULL,
  block_number  INTEGER,
  tx_hash       TEXT,
  chain         TEXT,
  details       TEXT,
  seq           INTEGER NOT NULL,
  event_json    JSONB   NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_trace ON events(trace_id);
CREATE INDEX IF NOT EXISTS idx_events_kind ON events(kind);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
CREATE INDEX IF NOT EXISTS idx_events_message_id ON events(message_id);

-- ---------------------------------------------------------------------------
-- Artifacts (raw file references)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS artifacts (
  id          SERIAL PRIMARY KEY,
  type        TEXT    NOT NULL,
  path        TEXT    NOT NULL,
  description TEXT,
  trace_id    INTEGER REFERENCES traces(id) ON DELETE SET NULL,
  import_id   INTEGER REFERENCES import_history(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(path)
);

-- ---------------------------------------------------------------------------
-- Checkpoints (RPC poller cursor tracking)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS checkpoints (
  id               SERIAL PRIMARY KEY,
  chain_id         TEXT    NOT NULL,
  contract_address TEXT    NOT NULL,
  last_block       INTEGER NOT NULL,
  block_hash       TEXT    NOT NULL,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(chain_id, contract_address)
);

-- ---------------------------------------------------------------------------
-- Webhook alert destinations
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS webhook_destinations (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  url           TEXT NOT NULL,
  secret        TEXT,
  enabled       BOOLEAN NOT NULL DEFAULT TRUE,
  events        JSONB NOT NULL DEFAULT '["execution_failed"]',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Webhook delivery log (at-least-once tracking)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id              SERIAL PRIMARY KEY,
  destination_id  INTEGER NOT NULL REFERENCES webhook_destinations(id) ON DELETE CASCADE,
  message_id      TEXT NOT NULL,
  event_kind      TEXT NOT NULL,
  payload_json    JSONB NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'delivered', 'failed', 'exhausted')),
  attempts        INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  next_retry_at   TIMESTAMPTZ,
  response_code   INTEGER,
  response_body   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_next_retry ON webhook_deliveries(next_retry_at)
  WHERE status = 'pending' OR status = 'failed';

-- ---------------------------------------------------------------------------
-- Relayer health snapshots (time-series)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS relayer_health (
  id                  SERIAL PRIMARY KEY,
  relayer_id          TEXT NOT NULL,
  status              TEXT NOT NULL CHECK (status IN ('healthy', 'degraded', 'unhealthy')),
  success_rate        REAL,
  latency_ms          REAL,
  lag_blocks          INTEGER,
  pending_messages    INTEGER,
  top_failures_json   JSONB,
  snapshot_json       JSONB NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_relayer_health_created ON relayer_health(created_at);
CREATE INDEX IF NOT EXISTS idx_relayer_health_relayer ON relayer_health(relayer_id, created_at);

-- ---------------------------------------------------------------------------
-- Sig-agg health snapshots (time-series)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sigagg_health (
  id                    SERIAL PRIMARY KEY,
  status                TEXT NOT NULL CHECK (status IN ('healthy', 'degraded', 'unhealthy')),
  aggregation_latency   REAL,
  connected_stake_json  JSONB,
  cache_hit_rate        REAL,
  snapshot_json         JSONB NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sigagg_health_created ON sigagg_health(created_at);

-- ---------------------------------------------------------------------------
-- Alert rules
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS alert_rules (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  condition     JSONB NOT NULL,
  destinations  JSONB NOT NULL,
  enabled       BOOLEAN NOT NULL DEFAULT TRUE,
  cooldown_ms   INTEGER NOT NULL DEFAULT 300000,
  last_fired_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_rules_enabled
  ON alert_rules(enabled) WHERE enabled = TRUE;
