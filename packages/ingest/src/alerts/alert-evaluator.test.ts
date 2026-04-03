import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { openDb, closeDb, type Database } from "@warplane/storage";
import { runMigrations, createSqliteAdapter } from "@warplane/storage";
import type { DatabaseAdapter } from "@warplane/storage";
import { insertAlertRule, insertWebhookDestination } from "@warplane/storage";
import { createAlertEvaluator } from "./alert-evaluator.js";
import { createDeliveryEngine } from "./webhook-delivery.js";
import type { CorrelationResult } from "../pipeline/types.js";
import type { MessageTrace } from "@warplane/domain";

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

function makeTrace(): MessageTrace {
  return {
    schemaVersion: "1.0.0",
    messageId: "msg-001",
    scenario: "basic_send_receive",
    execution: "success",
    source: { blockchainId: "chain-a", name: "Chain A", subnetId: "sub-a", evmChainId: 1 },
    destination: { blockchainId: "chain-b", name: "Chain B", subnetId: "sub-b", evmChainId: 2 },
    sender: "0xSender",
    recipient: "0xRecipient",
    sourceTxHash: "0xtx1",
    timestamps: {
      sendTime: "2026-01-01T00:00:00Z",
      receiveTime: "2026-01-01T00:01:00Z",
      blockSend: 100,
    },
    events: [],
  };
}

function makeResult(overrides?: Partial<CorrelationResult>): CorrelationResult {
  return {
    messageId: "msg-001",
    previousState: "pending",
    newState: "failed",
    trace: makeTrace(),
    isNew: false,
    isStateChange: true,
    ...overrides,
  };
}

describe("AlertEvaluator", () => {
  it("fires on matching state_change condition", async () => {
    const destId = await insertWebhookDestination(db, {
      name: "test-dest",
      url: "https://example.com/hook",
    });
    await insertAlertRule(db, {
      name: "on-failure",
      condition: { type: "state_change", toState: "failed" },
      destinations: [destId],
    });

    const engine = createDeliveryEngine(db);
    const enqueueSpy = vi.spyOn(engine, "enqueue");

    const evaluator = createAlertEvaluator(db, engine, { refreshIntervalMs: 0 });

    await evaluator.evaluate(makeResult({ newState: "failed", isStateChange: true }));

    expect(enqueueSpy).toHaveBeenCalledTimes(1);
    expect(enqueueSpy.mock.calls[0]![0]).toBe(destId);

    evaluator.stop();
  });

  it("skips non-matching state transitions", async () => {
    const destId = await insertWebhookDestination(db, {
      name: "test-dest",
      url: "https://example.com/hook",
    });
    await insertAlertRule(db, {
      name: "on-failure",
      condition: { type: "state_change", toState: "failed" },
      destinations: [destId],
    });

    const engine = createDeliveryEngine(db);
    const enqueueSpy = vi.spyOn(engine, "enqueue");

    const evaluator = createAlertEvaluator(db, engine, { refreshIntervalMs: 0 });

    // State change to "delivered" — does not match "failed" rule
    await evaluator.evaluate(makeResult({ newState: "delivered", isStateChange: true }));

    expect(enqueueSpy).not.toHaveBeenCalled();
    evaluator.stop();
  });

  it("cooldown prevents re-firing within cooldownMs", async () => {
    const destId = await insertWebhookDestination(db, {
      name: "test-dest",
      url: "https://example.com/hook",
    });
    await insertAlertRule(db, {
      name: "on-failure",
      condition: { type: "state_change", toState: "failed" },
      destinations: [destId],
      cooldownMs: 60000, // 1 minute cooldown
    });

    const engine = createDeliveryEngine(db);
    const enqueueSpy = vi.spyOn(engine, "enqueue");

    const evaluator = createAlertEvaluator(db, engine, { refreshIntervalMs: 0 });

    // First evaluation — should fire
    await evaluator.evaluate(makeResult());
    expect(enqueueSpy).toHaveBeenCalledTimes(1);

    // Second evaluation within cooldown — should NOT fire
    await evaluator.evaluate(makeResult({ messageId: "msg-002" }));
    expect(enqueueSpy).toHaveBeenCalledTimes(1); // still 1

    evaluator.stop();
  });

  it("cooldown allows firing after cooldownMs expires", async () => {
    const destId = await insertWebhookDestination(db, {
      name: "test-dest",
      url: "https://example.com/hook",
    });
    await insertAlertRule(db, {
      name: "on-failure",
      condition: { type: "state_change", toState: "failed" },
      destinations: [destId],
      cooldownMs: 100, // 100ms cooldown
    });

    const engine = createDeliveryEngine(db);
    const enqueueSpy = vi.spyOn(engine, "enqueue");

    const evaluator = createAlertEvaluator(db, engine, { refreshIntervalMs: 0 });

    // First evaluation — fires
    await evaluator.evaluate(makeResult());
    expect(enqueueSpy).toHaveBeenCalledTimes(1);

    // Wait for cooldown to expire
    await new Promise((r) => setTimeout(r, 150));

    // Second evaluation — should fire (cooldown expired, in-memory lastFiredAt is old enough)
    await evaluator.evaluate(makeResult({ messageId: "msg-002" }));
    expect(enqueueSpy).toHaveBeenCalledTimes(2);

    evaluator.stop();
  });

  it("disabled rules are skipped", async () => {
    const destId = await insertWebhookDestination(db, {
      name: "test-dest",
      url: "https://example.com/hook",
    });
    await insertAlertRule(db, {
      name: "disabled-rule",
      condition: { type: "state_change", toState: "failed" },
      destinations: [destId],
      enabled: false,
    });

    const engine = createDeliveryEngine(db);
    const enqueueSpy = vi.spyOn(engine, "enqueue");

    const evaluator = createAlertEvaluator(db, engine, { refreshIntervalMs: 0 });
    await evaluator.evaluate(makeResult());

    expect(enqueueSpy).not.toHaveBeenCalled();
    evaluator.stop();
  });

  it("dispatches to multiple destinations", async () => {
    const dest1 = await insertWebhookDestination(db, { name: "dest-1", url: "https://a.com" });
    const dest2 = await insertWebhookDestination(db, { name: "dest-2", url: "https://b.com" });

    await insertAlertRule(db, {
      name: "multi-dest",
      condition: { type: "state_change", toState: "failed" },
      destinations: [dest1, dest2],
    });

    const engine = createDeliveryEngine(db);
    const enqueueSpy = vi.spyOn(engine, "enqueue");

    const evaluator = createAlertEvaluator(db, engine, { refreshIntervalMs: 0 });
    await evaluator.evaluate(makeResult());

    expect(enqueueSpy).toHaveBeenCalledTimes(2);
    expect(enqueueSpy.mock.calls[0]![0]).toBe(dest1);
    expect(enqueueSpy.mock.calls[1]![0]).toBe(dest2);

    evaluator.stop();
  });

  it("refreshRules picks up new rules", async () => {
    const destId = await insertWebhookDestination(db, { name: "dest", url: "https://a.com" });

    const engine = createDeliveryEngine(db);
    const enqueueSpy = vi.spyOn(engine, "enqueue");

    const evaluator = createAlertEvaluator(db, engine, { refreshIntervalMs: 0 });

    // Evaluate before any rules exist — no dispatch
    await evaluator.evaluate(makeResult());
    expect(enqueueSpy).not.toHaveBeenCalled();

    // Add a rule
    await insertAlertRule(db, {
      name: "new-rule",
      condition: { type: "state_change", toState: "failed" },
      destinations: [destId],
    });

    // Refresh and evaluate again
    await evaluator.refreshRules();
    await evaluator.evaluate(makeResult());
    expect(enqueueSpy).toHaveBeenCalledTimes(1);

    evaluator.stop();
  });

  it("handles no matching rules gracefully", async () => {
    const engine = createDeliveryEngine(db);
    const enqueueSpy = vi.spyOn(engine, "enqueue");

    const evaluator = createAlertEvaluator(db, engine, { refreshIntervalMs: 0 });
    await evaluator.evaluate(makeResult());

    expect(enqueueSpy).not.toHaveBeenCalled();
    evaluator.stop();
  });
});
