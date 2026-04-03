/**
 * Alert evaluator — checks pipeline state changes against active alert rules.
 *
 * Loaded rules are cached in memory and refreshed periodically.
 * When a rule matches, the evaluator dispatches webhooks to all configured destinations.
 */

import type { DatabaseAdapter } from "@warplane/storage";
import { listAlertRules, markAlertRuleFired } from "@warplane/storage";
import type { AlertRule } from "@warplane/storage";
import type { CorrelationResult } from "../pipeline/types.js";
import type { WebhookPayload } from "./types.js";
import type { WebhookDeliveryEngine } from "./webhook-delivery.js";

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface AlertEvaluator {
  /** Evaluate a correlation result against all active rules. */
  evaluate(result: CorrelationResult): Promise<void>;
  /** Reload rules from storage. */
  refreshRules(): Promise<void>;
  /** Stop periodic refresh. */
  stop(): void;
}

export interface AlertEvaluatorConfig {
  /** How often to reload rules from storage (default: 30000ms). */
  refreshIntervalMs?: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createAlertEvaluator(
  db: DatabaseAdapter,
  deliveryEngine: WebhookDeliveryEngine,
  config?: AlertEvaluatorConfig,
): AlertEvaluator {
  let rules: AlertRule[] = [];
  let refreshTimer: ReturnType<typeof setInterval> | null = null;
  let initialLoadDone = false;

  async function refreshRules(): Promise<void> {
    rules = await listAlertRules(db, { enabled: true });
    initialLoadDone = true;
  }

  async function evaluate(result: CorrelationResult): Promise<void> {
    if (!initialLoadDone) {
      await refreshRules();
    }

    for (const rule of rules) {
      if (!rule.enabled) continue;

      const matches = evaluateCondition(rule, result);
      if (!matches) continue;

      // Check cooldown
      if (rule.lastFiredAt) {
        const lastFired = new Date(rule.lastFiredAt).getTime();
        const now = Date.now();
        if (now - lastFired < rule.cooldownMs) continue;
      }

      // Fire alert — dispatch to all destinations
      const payload = buildPayload(rule, result);
      for (const destId of rule.destinations) {
        await deliveryEngine.enqueue(destId, payload);
      }

      // Mark rule as fired
      await markAlertRuleFired(db, rule.id);
      rule.lastFiredAt = new Date().toISOString();
    }
  }

  function stop(): void {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  }

  // Start periodic refresh
  const refreshMs = config?.refreshIntervalMs ?? 30_000;
  if (refreshMs > 0) {
    refreshTimer = setInterval(() => {
      refreshRules().catch(() => {
        /* swallow — logged at higher level */
      });
    }, refreshMs);
  }

  return { evaluate, refreshRules, stop };
}

// ---------------------------------------------------------------------------
// Condition evaluation
// ---------------------------------------------------------------------------

function evaluateCondition(rule: AlertRule, result: CorrelationResult): boolean {
  const cond = rule.condition;

  switch (cond.type) {
    case "state_change":
      return result.isStateChange && result.newState === cond.toState;

    case "timeout":
      // Timeout conditions are handled by the StaleDetector, not here.
      // The StaleDetector creates synthetic CorrelationResults for stale messages.
      return false;

    case "relayer_health":
    case "sigagg_health":
    case "stake_below":
      // Health-based conditions are evaluated separately on metric snapshot inserts.
      return false;

    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Payload construction
// ---------------------------------------------------------------------------

function buildPayload(rule: AlertRule, result: CorrelationResult): WebhookPayload {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    type: rule.condition.type,
    messageId: result.messageId,
    data: {
      ruleName: rule.name,
      ruleId: rule.id,
      previousState: result.previousState,
      newState: result.newState,
      severity: "warning",
    },
  };
}
