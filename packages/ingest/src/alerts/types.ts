/**
 * Alert and webhook delivery types for Stage 6 — Alerting & Webhooks.
 *
 * AlertCondition is a discriminated union of all supported alert triggers.
 * AlertRule pairs a condition with webhook destinations and cooldown logic.
 * WebhookPayload is the JSON body POSTed to webhook destinations.
 */

import type { MessageState } from "../pipeline/types.js";

// ---------------------------------------------------------------------------
// Alert conditions — discriminated union
// ---------------------------------------------------------------------------

export interface StateChangeCondition {
  type: "state_change";
  toState: MessageState;
}

export interface TimeoutCondition {
  type: "timeout";
  durationMs: number;
}

export interface RelayerHealthCondition {
  type: "relayer_health";
  status: "degraded" | "unhealthy";
}

export interface SigAggHealthCondition {
  type: "sigagg_health";
  status: "degraded" | "unhealthy";
}

export interface StakeBelowCondition {
  type: "stake_below";
  threshold: number; // percentage 0–100
}

export type AlertCondition =
  | StateChangeCondition
  | TimeoutCondition
  | RelayerHealthCondition
  | SigAggHealthCondition
  | StakeBelowCondition;

// ---------------------------------------------------------------------------
// Alert rules
// ---------------------------------------------------------------------------

export interface AlertRule {
  id: string;
  name: string;
  condition: AlertCondition;
  destinations: number[]; // webhook_destination IDs
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
// Webhook payload — the JSON body sent to destinations
// ---------------------------------------------------------------------------

export interface WebhookPayload {
  /** Unique delivery ID */
  id: string;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Alert condition type that triggered this delivery */
  type: string;
  /** For message-specific alerts */
  messageId?: string;
  /** Condition-specific payload data */
  data: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Delivery result from processing queue
// ---------------------------------------------------------------------------

export interface DeliveryResult {
  deliveryId: number;
  destinationId: number;
  success: boolean;
  statusCode?: number;
  error?: string;
}
