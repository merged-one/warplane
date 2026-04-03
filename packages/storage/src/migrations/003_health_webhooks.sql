-- Health snapshot and webhook tables for operational observability.

-- Webhook alert destinations
CREATE TABLE IF NOT EXISTS webhook_destinations (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  url           TEXT NOT NULL,
  secret        TEXT,                -- HMAC-SHA256 signing secret
  enabled       INTEGER NOT NULL DEFAULT 1,
  events        TEXT NOT NULL DEFAULT '["execution_failed"]',  -- JSON array of event kinds
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Webhook delivery log (at-least-once tracking)
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

CREATE INDEX idx_webhook_deliveries_status ON webhook_deliveries(status);
CREATE INDEX idx_webhook_deliveries_next_retry ON webhook_deliveries(next_retry_at)
  WHERE status = 'pending' OR status = 'failed';

-- Relayer health snapshots (time-series)
CREATE TABLE IF NOT EXISTS relayer_health (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  relayer_id          TEXT NOT NULL,
  status              TEXT NOT NULL CHECK (status IN ('healthy', 'degraded', 'unhealthy')),
  success_rate        REAL,
  latency_ms          REAL,
  lag_blocks          INTEGER,
  pending_messages    INTEGER,
  top_failures_json   TEXT,           -- JSON array of {reason, count}
  snapshot_json       TEXT NOT NULL,   -- Full RelayerHealthSnapshot
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_relayer_health_created ON relayer_health(created_at);
CREATE INDEX idx_relayer_health_relayer ON relayer_health(relayer_id, created_at);

-- Sig-agg health snapshots (time-series)
CREATE TABLE IF NOT EXISTS sigagg_health (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  status                TEXT NOT NULL CHECK (status IN ('healthy', 'degraded', 'unhealthy')),
  aggregation_latency   REAL,
  connected_stake_json  TEXT,          -- JSON: {subnetId: percentage}
  cache_hit_rate        REAL,
  snapshot_json         TEXT NOT NULL,
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_sigagg_health_created ON sigagg_health(created_at);
