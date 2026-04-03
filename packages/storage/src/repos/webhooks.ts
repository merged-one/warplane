/**
 * Repository for webhook destinations and delivery tracking.
 *
 * Uses the async DatabaseAdapter interface (ADR-0009).
 */

import type { DatabaseAdapter } from "../adapter.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WebhookDestination {
  id: number;
  name: string;
  url: string;
  secret: string | null;
  enabled: boolean;
  events: string[];
  createdAt: string;
  updatedAt: string;
}

export interface InsertWebhookDestination {
  name: string;
  url: string;
  secret?: string;
  enabled?: boolean;
  events?: string[];
}

export type DeliveryStatus = "pending" | "delivered" | "failed" | "exhausted";

export interface WebhookDelivery {
  id: number;
  destinationId: number;
  messageId: string;
  eventKind: string;
  payloadJson: string;
  status: DeliveryStatus;
  attempts: number;
  lastAttemptAt: string | null;
  nextRetryAt: string | null;
  responseCode: number | null;
  responseBody: string | null;
  createdAt: string;
}

export interface InsertWebhookDelivery {
  destinationId: number;
  messageId: string;
  eventKind: string;
  payloadJson: string;
}

// ---------------------------------------------------------------------------
// Destination CRUD
// ---------------------------------------------------------------------------

export async function insertWebhookDestination(
  db: DatabaseAdapter,
  dest: InsertWebhookDestination,
): Promise<number> {
  const result = await db.query<{ id: number }>(
    `INSERT INTO webhook_destinations (name, url, secret, enabled, events)
     VALUES (?, ?, ?, ?, ?)
     RETURNING id`,
    [
      dest.name,
      dest.url,
      dest.secret ?? null,
      dest.enabled !== false ? 1 : 0,
      JSON.stringify(dest.events ?? ["execution_failed"]),
    ],
  );
  return result.rows[0]!.id;
}

export async function getWebhookDestination(
  db: DatabaseAdapter,
  id: number,
): Promise<WebhookDestination | undefined> {
  const result = await db.query<RawWebhookDestination>(
    `SELECT id, name, url, secret, enabled, events, created_at, updated_at
     FROM webhook_destinations WHERE id = ?`,
    [id],
  );
  return result.rows[0] ? mapDestination(result.rows[0]) : undefined;
}

export async function listWebhookDestinations(
  db: DatabaseAdapter,
  opts?: { enabledOnly?: boolean },
): Promise<WebhookDestination[]> {
  const where = opts?.enabledOnly ? "WHERE enabled = 1" : "";
  const result = await db.query<RawWebhookDestination>(
    `SELECT id, name, url, secret, enabled, events, created_at, updated_at
     FROM webhook_destinations ${where}
     ORDER BY name`,
  );
  return result.rows.map(mapDestination);
}

export async function updateWebhookDestination(
  db: DatabaseAdapter,
  id: number,
  updates: Partial<
    Pick<InsertWebhookDestination, "name" | "url" | "secret" | "enabled" | "events">
  >,
): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (updates.name !== undefined) {
    sets.push("name = ?");
    params.push(updates.name);
  }
  if (updates.url !== undefined) {
    sets.push("url = ?");
    params.push(updates.url);
  }
  if (updates.secret !== undefined) {
    sets.push("secret = ?");
    params.push(updates.secret);
  }
  if (updates.enabled !== undefined) {
    sets.push("enabled = ?");
    params.push(updates.enabled ? 1 : 0);
  }
  if (updates.events !== undefined) {
    sets.push("events = ?");
    params.push(JSON.stringify(updates.events));
  }

  if (sets.length === 0) return;

  sets.push("updated_at = datetime('now')");
  params.push(id);

  await db.execute(`UPDATE webhook_destinations SET ${sets.join(", ")} WHERE id = ?`, params);
}

export async function deleteWebhookDestination(db: DatabaseAdapter, id: number): Promise<void> {
  await db.execute(`DELETE FROM webhook_destinations WHERE id = ?`, [id]);
}

// ---------------------------------------------------------------------------
// Delivery tracking
// ---------------------------------------------------------------------------

export async function insertWebhookDelivery(
  db: DatabaseAdapter,
  delivery: InsertWebhookDelivery,
): Promise<number> {
  const result = await db.query<{ id: number }>(
    `INSERT INTO webhook_deliveries (destination_id, message_id, event_kind, payload_json)
     VALUES (?, ?, ?, ?)
     RETURNING id`,
    [delivery.destinationId, delivery.messageId, delivery.eventKind, delivery.payloadJson],
  );
  return result.rows[0]!.id;
}

export async function markDeliveryStatus(
  db: DatabaseAdapter,
  id: number,
  status: DeliveryStatus,
  opts?: { responseCode?: number; responseBody?: string; nextRetryAt?: string },
): Promise<void> {
  await db.execute(
    `UPDATE webhook_deliveries
     SET status = ?, attempts = attempts + 1,
         last_attempt_at = datetime('now'),
         response_code = ?, response_body = ?,
         next_retry_at = ?
     WHERE id = ?`,
    [status, opts?.responseCode ?? null, opts?.responseBody ?? null, opts?.nextRetryAt ?? null, id],
  );
}

export async function getPendingDeliveries(
  db: DatabaseAdapter,
  opts?: { limit?: number },
): Promise<WebhookDelivery[]> {
  const limit = opts?.limit ?? 50;
  const result = await db.query<RawWebhookDelivery>(
    `SELECT id, destination_id, message_id, event_kind, payload_json,
            status, attempts, last_attempt_at, next_retry_at,
            response_code, response_body, created_at
     FROM webhook_deliveries
     WHERE status IN ('pending', 'failed')
       AND (next_retry_at IS NULL OR next_retry_at <= datetime('now'))
     ORDER BY created_at ASC
     LIMIT ?`,
    [limit],
  );
  return result.rows.map(mapDelivery);
}

export async function getDeliveriesForMessage(
  db: DatabaseAdapter,
  messageId: string,
): Promise<WebhookDelivery[]> {
  const result = await db.query<RawWebhookDelivery>(
    `SELECT id, destination_id, message_id, event_kind, payload_json,
            status, attempts, last_attempt_at, next_retry_at,
            response_code, response_body, created_at
     FROM webhook_deliveries
     WHERE message_id = ?
     ORDER BY created_at DESC`,
    [messageId],
  );
  return result.rows.map(mapDelivery);
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

interface RawWebhookDestination {
  id: number;
  name: string;
  url: string;
  secret: string | null;
  enabled: number;
  events: string;
  created_at: string;
  updated_at: string;
}

function mapDestination(row: RawWebhookDestination): WebhookDestination {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    secret: row.secret,
    enabled: row.enabled === 1,
    events: JSON.parse(row.events),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface RawWebhookDelivery {
  id: number;
  destination_id: number;
  message_id: string;
  event_kind: string;
  payload_json: string;
  status: DeliveryStatus;
  attempts: number;
  last_attempt_at: string | null;
  next_retry_at: string | null;
  response_code: number | null;
  response_body: string | null;
  created_at: string;
}

function mapDelivery(row: RawWebhookDelivery): WebhookDelivery {
  return {
    id: row.id,
    destinationId: row.destination_id,
    messageId: row.message_id,
    eventKind: row.event_kind,
    payloadJson: row.payload_json,
    status: row.status,
    attempts: row.attempts,
    lastAttemptAt: row.last_attempt_at,
    nextRetryAt: row.next_retry_at,
    responseCode: row.response_code,
    responseBody: row.response_body,
    createdAt: row.created_at,
  };
}
