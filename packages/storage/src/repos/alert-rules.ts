/**
 * Repository for alert rules.
 *
 * Uses the async DatabaseAdapter interface (ADR-0009), same pattern as webhooks.ts.
 */

import type { DatabaseAdapter } from "../adapter.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AlertCondition {
  type: "state_change" | "timeout" | "relayer_health" | "sigagg_health" | "stake_below";
  [key: string]: unknown;
}

export interface AlertRule {
  id: string;
  name: string;
  condition: AlertCondition;
  destinations: number[];
  enabled: boolean;
  cooldownMs: number;
  lastFiredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InsertAlertRule {
  name: string;
  condition: AlertCondition;
  destinations: number[];
  enabled?: boolean;
  cooldownMs?: number;
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function insertAlertRule(db: DatabaseAdapter, rule: InsertAlertRule): Promise<string> {
  const id = crypto.randomUUID();
  await db.execute(
    `INSERT INTO alert_rules (id, name, condition, destinations, enabled, cooldown_ms)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      id,
      rule.name,
      JSON.stringify(rule.condition),
      JSON.stringify(rule.destinations),
      rule.enabled !== false ? 1 : 0,
      rule.cooldownMs ?? 300000,
    ],
  );
  return id;
}

export async function getAlertRule(
  db: DatabaseAdapter,
  id: string,
): Promise<AlertRule | undefined> {
  const result = await db.query<RawAlertRule>(
    `SELECT id, name, condition, destinations, enabled, cooldown_ms,
            last_fired_at, created_at, updated_at
     FROM alert_rules WHERE id = ?`,
    [id],
  );
  return result.rows[0] ? mapRule(result.rows[0]) : undefined;
}

export async function listAlertRules(
  db: DatabaseAdapter,
  opts?: { enabled?: boolean },
): Promise<AlertRule[]> {
  const where = opts?.enabled !== undefined ? `WHERE enabled = ${opts.enabled ? 1 : 0}` : "";
  const result = await db.query<RawAlertRule>(
    `SELECT id, name, condition, destinations, enabled, cooldown_ms,
            last_fired_at, created_at, updated_at
     FROM alert_rules ${where}
     ORDER BY name`,
  );
  return result.rows.map(mapRule);
}

export async function updateAlertRule(
  db: DatabaseAdapter,
  id: string,
  updates: Partial<
    Pick<InsertAlertRule, "name" | "condition" | "destinations" | "enabled" | "cooldownMs">
  >,
): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (updates.name !== undefined) {
    sets.push("name = ?");
    params.push(updates.name);
  }
  if (updates.condition !== undefined) {
    sets.push("condition = ?");
    params.push(JSON.stringify(updates.condition));
  }
  if (updates.destinations !== undefined) {
    sets.push("destinations = ?");
    params.push(JSON.stringify(updates.destinations));
  }
  if (updates.enabled !== undefined) {
    sets.push("enabled = ?");
    params.push(updates.enabled ? 1 : 0);
  }
  if (updates.cooldownMs !== undefined) {
    sets.push("cooldown_ms = ?");
    params.push(updates.cooldownMs);
  }

  if (sets.length === 0) return;

  sets.push("updated_at = datetime('now')");
  params.push(id);

  await db.execute(`UPDATE alert_rules SET ${sets.join(", ")} WHERE id = ?`, params);
}

export async function deleteAlertRule(db: DatabaseAdapter, id: string): Promise<void> {
  await db.execute(`DELETE FROM alert_rules WHERE id = ?`, [id]);
}

export async function markAlertRuleFired(db: DatabaseAdapter, id: string): Promise<void> {
  await db.execute(
    `UPDATE alert_rules SET last_fired_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
    [id],
  );
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

interface RawAlertRule {
  id: string;
  name: string;
  condition: string;
  destinations: string;
  enabled: number;
  cooldown_ms: number;
  last_fired_at: string | null;
  created_at: string;
  updated_at: string;
}

function mapRule(row: RawAlertRule): AlertRule {
  return {
    id: row.id,
    name: row.name,
    condition: JSON.parse(row.condition),
    destinations: JSON.parse(row.destinations),
    enabled: row.enabled === 1,
    cooldownMs: row.cooldown_ms,
    lastFiredAt: row.last_fired_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
