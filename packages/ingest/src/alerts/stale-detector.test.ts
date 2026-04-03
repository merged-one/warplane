import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { openDb, closeDb, type Database } from "@warplane/storage";
import { runMigrations, createSqliteAdapter } from "@warplane/storage";
import { insertAlertRule, insertWebhookDestination } from "@warplane/storage";
import type { DatabaseAdapter } from "@warplane/storage";
import { createStaleDetector } from "./stale-detector.js";
import { createDeliveryEngine } from "./webhook-delivery.js";

let rawDb: Database;
let db: DatabaseAdapter;

beforeEach(() => {
  rawDb = openDb({ path: ":memory:" });
  runMigrations(rawDb);
  db = createSqliteAdapter(rawDb);
});

afterEach(() => {
  closeDb(rawDb);
  vi.restoreAllMocks();
});

/** Insert a minimal trace row directly for testing (avoids full MessageTrace validation). */
function insertTraceRow(
  rawDb: Database,
  opts: { messageId: string; execution: string; sendTimeAge: number },
): void {
  const sendTime = new Date(Date.now() - opts.sendTimeAge).toISOString();
  rawDb
    .prepare(
      `INSERT INTO traces (message_id, scenario, execution, send_time, trace_json)
       VALUES (?, 'basic_send_receive', ?, ?, '{}')`,
    )
    .run(opts.messageId, opts.execution, sendTime);
}

describe("StaleDetector", () => {
  it("detects pending message exceeding timeout", async () => {
    // Insert a pending trace that is 10 minutes old
    insertTraceRow(rawDb, {
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

    const detector = createStaleDetector(rawDb, db, engine, {
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
    insertTraceRow(rawDb, {
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

    const detector = createStaleDetector(rawDb, db, engine);
    await detector.scan();

    expect(enqueueSpy).not.toHaveBeenCalled();
    detector.stop();
  });

  it("does not re-alert already-alerted messages within TTL", async () => {
    insertTraceRow(rawDb, {
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

    const detector = createStaleDetector(rawDb, db, engine);

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
    insertTraceRow(rawDb, {
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

    const detector = createStaleDetector(rawDb, db, engine, {
      pendingTimeoutMs: 60_000, // 1 min
    });

    await detector.scan();

    // Message is 2 min old, threshold is 1 min — should alert
    expect(enqueueSpy).toHaveBeenCalledTimes(1);
    detector.stop();
  });
});
