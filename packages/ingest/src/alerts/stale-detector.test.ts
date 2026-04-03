import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestAdapter, initTestSchema } from "@warplane/storage/test-utils";
import type { DatabaseAdapter } from "@warplane/storage";
import { insertAlertRule, insertWebhookDestination } from "@warplane/storage";
import { createStaleDetector } from "./stale-detector.js";
import { createDeliveryEngine } from "./webhook-delivery.js";

let db: DatabaseAdapter;

beforeEach(async () => {
  db = createTestAdapter();
  await initTestSchema(db);
});

afterEach(async () => {
  await db.close();
  vi.restoreAllMocks();
});

/** Insert a minimal trace row directly for testing (avoids full MessageTrace validation). */
async function insertTraceRow(
  db: DatabaseAdapter,
  opts: { messageId: string; execution: string; sendTimeAge: number },
): Promise<void> {
  const sendTime = new Date(Date.now() - opts.sendTimeAge).toISOString();
  await db.execute(
    `INSERT INTO traces (message_id, scenario, execution, send_time, trace_json)
     VALUES (?, 'basic_send_receive', ?, ?, '{}')`,
    [opts.messageId, opts.execution, sendTime],
  );
}

describe("StaleDetector", () => {
  it("detects pending message exceeding timeout", async () => {
    // Insert a pending trace that is 10 minutes old
    await insertTraceRow(db, {
      messageId: "stale-msg-001",
      execution: "pending",
      sendTimeAge: 600_000,
    });

    const destId = await insertWebhookDestination(db, {
      name: "stale-hook",
      url: "https://example.com/hook",
    });
    await insertAlertRule(db, {
      name: "timeout-rule",
      condition: { type: "timeout", durationMs: 300_000 }, // 5 min timeout
      destinations: [destId],
    });

    const engine = createDeliveryEngine(db);
    const enqueueSpy = vi.spyOn(engine, "enqueue");

    const detector = createStaleDetector(db, engine, {
      pendingTimeoutMs: 300_000,
    });

    await detector.scan();

    expect(enqueueSpy).toHaveBeenCalledTimes(1);
    const payload = enqueueSpy.mock.calls[0]![1];
    expect(payload.messageId).toBe("stale-msg-001");
    expect(payload.type).toBe("timeout");

    detector.stop();
  });

  it("ignores delivered/completed messages", async () => {
    // Insert a delivered trace
    await insertTraceRow(db, {
      messageId: "delivered-msg-001",
      execution: "delivered",
      sendTimeAge: 600_000,
    });

    const destId = await insertWebhookDestination(db, {
      name: "stale-hook",
      url: "https://example.com/hook",
    });
    await insertAlertRule(db, {
      name: "timeout-rule",
      condition: { type: "timeout", durationMs: 300_000 },
      destinations: [destId],
    });

    const engine = createDeliveryEngine(db);
    const enqueueSpy = vi.spyOn(engine, "enqueue");

    const detector = createStaleDetector(db, engine);
    await detector.scan();

    expect(enqueueSpy).not.toHaveBeenCalled();
    detector.stop();
  });

  it("does not re-alert already-alerted messages within TTL", async () => {
    await insertTraceRow(db, {
      messageId: "stale-msg-002",
      execution: "pending",
      sendTimeAge: 600_000,
    });

    const destId = await insertWebhookDestination(db, {
      name: "stale-hook",
      url: "https://example.com/hook",
    });
    await insertAlertRule(db, {
      name: "timeout-rule",
      condition: { type: "timeout", durationMs: 300_000 },
      destinations: [destId],
    });

    const engine = createDeliveryEngine(db);
    const enqueueSpy = vi.spyOn(engine, "enqueue");

    const detector = createStaleDetector(db, engine);

    // First scan — should alert
    await detector.scan();
    expect(enqueueSpy).toHaveBeenCalledTimes(1);

    // Second scan — should NOT alert (same message already tracked)
    await detector.scan();
    expect(enqueueSpy).toHaveBeenCalledTimes(1);

    detector.stop();
  });

  it("respects configurable timeout values", async () => {
    // Insert a pending trace that is 2 minutes old
    await insertTraceRow(db, {
      messageId: "recent-msg-001",
      execution: "pending",
      sendTimeAge: 120_000,
    });

    const destId = await insertWebhookDestination(db, {
      name: "stale-hook",
      url: "https://example.com/hook",
    });
    await insertAlertRule(db, {
      name: "strict-timeout",
      condition: { type: "timeout", durationMs: 60_000 }, // 1 min timeout
      destinations: [destId],
    });

    const engine = createDeliveryEngine(db);
    const enqueueSpy = vi.spyOn(engine, "enqueue");

    const detector = createStaleDetector(db, engine, {
      pendingTimeoutMs: 60_000, // 1 min
    });

    await detector.scan();

    // Message is 2 min old, threshold is 1 min — should alert
    expect(enqueueSpy).toHaveBeenCalledTimes(1);
    detector.stop();
  });
});
