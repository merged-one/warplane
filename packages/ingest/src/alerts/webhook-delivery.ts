/**
 * Webhook delivery engine — at-least-once delivery with HMAC-SHA256 signing.
 *
 * Follows Alchemy Notify's delivery model:
 * - HMAC-SHA256 signature in X-Warplane-Signature header
 * - Exponential backoff retry: 15s, 30s, 1m, 5m, 15m, 1h (6 attempts)
 * - Destination must respond 2xx within 10 seconds
 * - After 6 failed attempts, delivery is marked as exhausted
 */

import { createHmac } from "node:crypto";
import type { DatabaseAdapter } from "@warplane/storage";
import {
  insertWebhookDelivery,
  markDeliveryStatus,
  getPendingDeliveries,
  getWebhookDestination,
} from "@warplane/storage";
import type { WebhookPayload, DeliveryResult } from "./types.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Retry schedule in milliseconds: 15s, 30s, 1m, 5m, 15m, 1h */
export const RETRY_DELAYS_MS = [15_000, 30_000, 60_000, 300_000, 900_000, 3_600_000];

/** Maximum attempts before marking as exhausted */
export const MAX_ATTEMPTS = RETRY_DELAYS_MS.length;

/** Per-request timeout in milliseconds */
const DELIVERY_TIMEOUT_MS = 10_000;

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface WebhookDeliveryEngine {
  /** Enqueue a new delivery for a destination */
  enqueue(destinationId: number, payload: WebhookPayload): Promise<void>;
  /** Process all pending/failed deliveries that are ready for retry */
  processQueue(): Promise<DeliveryResult[]>;
  /** Start background processing on an interval */
  start(intervalMs?: number): void;
  /** Stop background processing */
  stop(): void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createDeliveryEngine(db: DatabaseAdapter): WebhookDeliveryEngine {
  let timer: ReturnType<typeof setInterval> | null = null;

  async function enqueue(destinationId: number, payload: WebhookPayload): Promise<void> {
    await insertWebhookDelivery(db, {
      destinationId,
      messageId: payload.messageId ?? "",
      eventKind: payload.type,
      payloadJson: JSON.stringify(payload),
    });
  }

  async function processQueue(): Promise<DeliveryResult[]> {
    const pending = await getPendingDeliveries(db, { limit: 50 });
    const results: DeliveryResult[] = [];

    for (const delivery of pending) {
      const dest = await getWebhookDestination(db, delivery.destinationId);
      if (!dest || !dest.enabled) {
        // Destination deleted or disabled — mark as exhausted
        await markDeliveryStatus(db, delivery.id, "exhausted");
        results.push({
          deliveryId: delivery.id,
          destinationId: delivery.destinationId,
          success: false,
          error: "destination_unavailable",
        });
        continue;
      }

      const payload = delivery.payloadJson;
      const result = await attemptDelivery(dest.url, dest.secret, payload);

      if (result.success) {
        await markDeliveryStatus(db, delivery.id, "delivered", {
          responseCode: result.statusCode,
        });
      } else {
        const nextAttempt = delivery.attempts + 1; // attempts incremented by markDeliveryStatus
        if (nextAttempt >= MAX_ATTEMPTS) {
          await markDeliveryStatus(db, delivery.id, "exhausted", {
            responseCode: result.statusCode,
            responseBody: result.error,
          });
        } else {
          const delayMs =
            RETRY_DELAYS_MS[nextAttempt] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]!;
          const nextRetryAt = new Date(Date.now() + delayMs)
            .toISOString()
            .replace("T", " ")
            .replace("Z", "");
          await markDeliveryStatus(db, delivery.id, "failed", {
            responseCode: result.statusCode,
            responseBody: result.error,
            nextRetryAt,
          });
        }
      }

      results.push({
        deliveryId: delivery.id,
        destinationId: delivery.destinationId,
        success: result.success,
        statusCode: result.statusCode,
        error: result.error,
      });
    }

    return results;
  }

  function start(intervalMs = 5000): void {
    if (timer) return;
    timer = setInterval(() => {
      processQueue().catch(() => {
        /* swallow — logged at higher level */
      });
    }, intervalMs);
  }

  function stop(): void {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  return { enqueue, processQueue, start, stop };
}

// ---------------------------------------------------------------------------
// HTTP delivery with HMAC signing
// ---------------------------------------------------------------------------

interface AttemptResult {
  success: boolean;
  statusCode?: number;
  error?: string;
}

async function attemptDelivery(
  url: string,
  secret: string | null,
  payloadJson: string,
): Promise<AttemptResult> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (secret) {
    const signature = createHmac("sha256", secret).update(payloadJson).digest("hex");
    headers["X-Warplane-Signature"] = signature;
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: payloadJson,
      signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
    });

    const success = response.status >= 200 && response.status < 300;
    let responseBody: string | undefined;
    try {
      responseBody = await response.text();
    } catch {
      // ignore body read errors
    }

    return {
      success,
      statusCode: response.status,
      error: success ? undefined : responseBody?.slice(0, 500),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error:
        message.includes("timed out") || message.includes("abort")
          ? "timeout"
          : message.slice(0, 500),
    };
  }
}

/**
 * Compute HMAC-SHA256 signature for a webhook payload.
 * Exported for use by the test endpoint.
 */
export function computeSignature(secret: string, payloadJson: string): string {
  return createHmac("sha256", secret).update(payloadJson).digest("hex");
}
