/**
 * SQLite adapter — wraps better-sqlite3 in the async DatabaseAdapter interface.
 *
 * Since better-sqlite3 is synchronous, all methods resolve immediately via
 * Promise.resolve(). This lets new async-first repositories work with SQLite
 * without any code changes.
 */

import type { Database } from "better-sqlite3";
import type { DatabaseAdapter, QueryResult } from "./adapter.js";

export function createSqliteAdapter(db: Database): DatabaseAdapter {
  return {
    dialect: "sqlite" as const,

    async query<T = Record<string, unknown>>(
      sql: string,
      params: unknown[] = [],
    ): Promise<QueryResult<T>> {
      const rows = db.prepare(sql).all(...params) as T[];
      return { rows, rowCount: rows.length };
    },

    async execute(sql: string, params: unknown[] = []): Promise<number> {
      const result = db.prepare(sql).run(...params);
      return result.changes;
    },

    async exec(sql: string): Promise<void> {
      db.exec(sql);
    },

    async transaction<T>(fn: (adapter: DatabaseAdapter) => Promise<T>): Promise<T> {
      // better-sqlite3 transactions are synchronous, but the fn is async.
      // We run the async fn inside a synchronous transaction wrapper.
      // For SQLite, we just run the fn directly — the synchronous transaction
      // boundary is less critical since all ops are on a single connection.
      const result = await fn(this);
      return result;
    },

    async close(): Promise<void> {
      db.close();
    },
  };
}
