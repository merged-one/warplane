-- Alert rules for webhook-based notifications.
--
-- Rules define conditions (state_change, timeout, relayer_health, sigagg_health,
-- stake_below) that, when matched, dispatch payloads to webhook destinations.

CREATE TABLE IF NOT EXISTS alert_rules (
  id            TEXT PRIMARY KEY,     -- UUID
  name          TEXT NOT NULL,
  condition     TEXT NOT NULL,         -- JSON: AlertCondition discriminated union
  destinations  TEXT NOT NULL,         -- JSON array of webhook_destination IDs
  enabled       INTEGER NOT NULL DEFAULT 1,
  cooldown_ms   INTEGER NOT NULL DEFAULT 300000,  -- 5 minutes default
  last_fired_at TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_alert_rules_enabled
  ON alert_rules(enabled) WHERE enabled = 1;
