/**
 * Stale message detector — periodic scan for messages stuck in non-terminal states.
 *
 * Scans the traces table for messages in pending/relaying/retrying states
 * that have exceeded configurable timeout thresholds. When found, fires
 * timeout-type alert rules via the alert evaluator's delivery engine.
 */

import type { DatabaseAdapter } from "@warplane/storage";
import { listAlertRules } from "@warplane/storage";
import type { WebhookDeliveryEngine } from "./webhook-delivery.js";
import type { WebhookPayload } from "./types.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface StaleDetectorConfig {
  /** Check interval in milliseconds (default: 60000 = 1 minute). */
  checkIntervalMs?: number;
  /** Time before a pending message is considered stale (default: 300000 = 5 min). */
  pendingTimeoutMs?: number;
  /** Time before a relaying message is considered stale (default: 120000 = 2 min). */
  relayingTimeoutMs?: number;
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface StaleDetector {
  /** Run one scan cycle. */
  scan(): Promise<void>;
  /** Start periodic scanning. */
  start(intervalMs?: number): void;
  /** Stop periodic scanning. */
  stop(): void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createStaleDetector(
  db: DatabaseAdapter,
  deliveryEngine: WebhookDeliveryEngine,
  config?: StaleDetectorConfig,
): StaleDetector {
  const pendingTimeoutMs = config?.pendingTimeoutMs ?? 300_000;

  /** Track already-alerted messages to avoid duplicate alerts. */
  const alertedMessages = new Map<string, number>(); // messageId → timestamp
  const ALERTED_TTL_MS = 600_000; // 10 minutes before re-alerting

  let timer: ReturnType<typeof setInterval> | null = null;

  async function scan(): Promise<void> {
    // Clean up expired entries from alertedMessages
    const now = Date.now();
    for (const [id, ts] of alertedMessages) {
      if (now - ts > ALERTED_TTL_MS) {
        alertedMessages.delete(id);
      }
    }

    // Find stale pending messages
    const pendingCutoff = new Date(now - pendingTimeoutMs).toISOString();
    const result = await db.query<{
      message_id: string;
      execution: string;
      send_time: string;
    }>(
      `SELECT message_id, execution, send_time
       FROM traces
       WHERE execution IN ('pending', 'failed')
         AND send_time IS NOT NULL
         AND send_time < ?
       ORDER BY send_time ASC
       LIMIT 100`,
      [pendingCutoff],
    );

    const staleRows = result.rows;

    // Load timeout rules
    const rules = await listAlertRules(db, { enabled: true });
    const timeoutRules = rules.filter((r) => r.condition.type === "timeout");

    if (timeoutRules.length === 0) return;

    for (const row of staleRows) {
      if (alertedMessages.has(row.message_id)) continue;

      const sendTime = new Date(row.send_time).getTime();
      const elapsedMs = now - sendTime;

      for (const rule of timeoutRules) {
        const condition = rule.condition as { type: "timeout"; durationMs: number };
        if (elapsedMs < condition.durationMs) continue;

        // Check cooldown
        if (rule.lastFiredAt) {
          const lastFired = new Date(rule.lastFiredAt).getTime();
          if (now - lastFired < rule.cooldownMs) continue;
        }

        const payload: WebhookPayload = {
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          type: "timeout",
          messageId: row.message_id,
          data: {
            ruleName: rule.name,
            ruleId: rule.id,
            execution: row.execution,
            elapsedMs,
            thresholdMs: condition.durationMs,
          },
        };

        for (const destId of rule.destinations) {
          await deliveryEngine.enqueue(destId, payload);
        }

        alertedMessages.set(row.message_id, now);
      }
    }
  }

  function start(intervalMs?: number): void {
    if (timer) return;
    const interval = intervalMs ?? config?.checkIntervalMs ?? 60_000;
    timer = setInterval(() => {
      scan().catch(() => {
        /* swallow — logged at higher level */
      });
    }, interval);
  }

  function stop(): void {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  return { scan, start, stop };
}
