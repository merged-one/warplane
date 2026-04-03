/**
 * Alerts barrel export — evaluator, delivery engine, stale detector, and types.
 */

// Types
export type { AlertCondition, WebhookPayload } from "./types.js";

// Alert evaluator
export {
  createAlertEvaluator,
  type AlertEvaluator,
  type AlertEvaluatorConfig,
} from "./alert-evaluator.js";

// Webhook delivery engine
export {
  createDeliveryEngine,
  computeSignature,
  RETRY_DELAYS_MS,
  MAX_ATTEMPTS,
  type WebhookDeliveryEngine,
} from "./webhook-delivery.js";

// Stale message detector
export {
  createStaleDetector,
  type StaleDetector,
  type StaleDetectorConfig,
} from "./stale-detector.js";
