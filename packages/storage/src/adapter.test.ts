import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestAdapter, initTestSchema } from "./test-utils/index.js";
import type { DatabaseAdapter } from "./adapter.js";

let db: DatabaseAdapter;

beforeEach(async () => {
  db = createTestAdapter();
  await initTestSchema(db);
});

afterEach(async () => {
  await db.close();
});

describe("TestAdapter (DatabaseAdapter)", () => {
  it("reports sqlite dialect", () => {
    expect(db.dialect).toBe("sqlite");
  });

  it("migration 003 creates health and webhook tables", async () => {
    const tables = await db.query<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`,
    );
    const names = tables.rows.map((r) => r.name);
    expect(names).toContain("relayer_health");
    expect(names).toContain("sigagg_health");
    expect(names).toContain("webhook_destinations");
    expect(names).toContain("webhook_deliveries");
  });

  it("query() returns rows and rowCount", async () => {
    await db.execute(
      `INSERT INTO relayer_health (relayer_id, status, snapshot_json) VALUES (?, ?, ?)`,
      ["r1", "healthy", "{}"],
    );

    const result = await db.query<{ relayer_id: string }>(`SELECT relayer_id FROM relayer_health`);
    expect(result.rowCount).toBe(1);
    expect(result.rows[0]!.relayer_id).toBe("r1");
  });

  it("execute() returns affected row count", async () => {
    await db.execute(
      `INSERT INTO relayer_health (relayer_id, status, snapshot_json) VALUES (?, ?, ?)`,
      ["r1", "healthy", "{}"],
    );
    await db.execute(
      `INSERT INTO relayer_health (relayer_id, status, snapshot_json) VALUES (?, ?, ?)`,
      ["r2", "degraded", "{}"],
    );

    const count = await db.execute(`DELETE FROM relayer_health WHERE status = ?`, ["healthy"]);
    expect(count).toBe(1);
  });

  it("exec() runs raw SQL", async () => {
    await db.exec(`CREATE TABLE test_table (id INTEGER PRIMARY KEY, val TEXT)`);
    const result = await db.query<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'test_table'`,
    );
    expect(result.rowCount).toBe(1);
  });
});
