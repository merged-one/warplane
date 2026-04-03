-- Health snapshot and webhook tables for operational observability (Postgres).

-- Webhook alert destinations
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

-- Webhook delivery log (at-least-once tracking)
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

CREATE INDEX idx_webhook_deliveries_status ON webhook_deliveries(status);
CREATE INDEX idx_webhook_deliveries_next_retry ON webhook_deliveries(next_retry_at)
  WHERE status = 'pending' OR status = 'failed';

-- Relayer health snapshots (time-series)
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

-- BRIN index optimal for time-ordered inserts (10x smaller than B-tree)
CREATE INDEX idx_relayer_health_created ON relayer_health USING BRIN (created_at);
CREATE INDEX idx_relayer_health_relayer ON relayer_health(relayer_id, created_at);

-- Sig-agg health snapshots (time-series)
CREATE TABLE IF NOT EXISTS sigagg_health (
  id                    SERIAL PRIMARY KEY,
  status                TEXT NOT NULL CHECK (status IN ('healthy', 'degraded', 'unhealthy')),
  aggregation_latency   REAL,
  connected_stake_json  JSONB,
  cache_hit_rate        REAL,
  snapshot_json         JSONB NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sigagg_health_created ON sigagg_health USING BRIN (created_at);
