import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestAdapter, initTestSchema } from "../test-utils/index.js";
import type { DatabaseAdapter } from "../adapter.js";
import {
  insertAlertRule,
  getAlertRule,
  listAlertRules,
  updateAlertRule,
  deleteAlertRule,
  markAlertRuleFired,
} from "./alert-rules.js";

let db: DatabaseAdapter;

beforeEach(async () => {
  db = createTestAdapter();
  await initTestSchema(db);
});

afterEach(async () => {
  await db.close();
});

describe("Alert Rules", () => {
  it("inserts and retrieves an alert rule", async () => {
    const id = await insertAlertRule(db, {
      name: "failed-execution",
      condition: { type: "state_change", toState: "failed" },
      destinations: [1, 2],
      cooldownMs: 60000,
    });
    expect(id).toBeTruthy();

    const rule = await getAlertRule(db, id);
    expect(rule).toBeDefined();
    expect(rule!.name).toBe("failed-execution");
    expect(rule!.condition).toEqual({ type: "state_change", toState: "failed" });
    expect(rule!.destinations).toEqual([1, 2]);
    expect(rule!.enabled).toBe(true);
    expect(rule!.cooldownMs).toBe(60000);
    expect(rule!.lastFiredAt).toBeNull();
    expect(rule!.createdAt).toBeTruthy();
  });

  it("lists enabled-only rules", async () => {
    await insertAlertRule(db, {
      name: "active-rule",
      condition: { type: "state_change", toState: "failed" },
      destinations: [1],
    });
    await insertAlertRule(db, {
      name: "disabled-rule",
      condition: { type: "timeout", durationMs: 300000 },
      destinations: [1],
      enabled: false,
    });

    const all = await listAlertRules(db);
    expect(all).toHaveLength(2);

    const enabledOnly = await listAlertRules(db, { enabled: true });
    expect(enabledOnly).toHaveLength(1);
    expect(enabledOnly[0]!.name).toBe("active-rule");
  });

  it("updates rule fields", async () => {
    const id = await insertAlertRule(db, {
      name: "original",
      condition: { type: "state_change", toState: "failed" },
      destinations: [1],
    });

    await updateAlertRule(db, id, {
      name: "updated-name",
      condition: { type: "timeout", durationMs: 120000 },
      enabled: false,
      cooldownMs: 10000,
    });

    const rule = await getAlertRule(db, id);
    expect(rule!.name).toBe("updated-name");
    expect(rule!.condition).toEqual({ type: "timeout", durationMs: 120000 });
    expect(rule!.enabled).toBe(false);
    expect(rule!.cooldownMs).toBe(10000);
  });

  it("deletes a rule", async () => {
    const id = await insertAlertRule(db, {
      name: "to-delete",
      condition: { type: "state_change", toState: "failed" },
      destinations: [1],
    });

    await deleteAlertRule(db, id);
    const rule = await getAlertRule(db, id);
    expect(rule).toBeUndefined();
  });

  it("marks rule as fired and updates last_fired_at", async () => {
    const id = await insertAlertRule(db, {
      name: "firing-rule",
      condition: { type: "state_change", toState: "failed" },
      destinations: [1],
    });

    const before = await getAlertRule(db, id);
    expect(before!.lastFiredAt).toBeNull();

    await markAlertRuleFired(db, id);

    const after = await getAlertRule(db, id);
    expect(after!.lastFiredAt).toBeTruthy();
  });

  it("returns undefined for unknown rule id", async () => {
    const rule = await getAlertRule(db, "nonexistent-uuid");
    expect(rule).toBeUndefined();
  });
});
