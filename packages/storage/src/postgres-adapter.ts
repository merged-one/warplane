/**
 * Postgres adapter — implements DatabaseAdapter using the `postgres` (porsager) driver.
 *
 * Usage:
 *   import { createPostgresAdapter } from "@warplane/storage/postgres-adapter";
 *   const adapter = await createPostgresAdapter({ connectionString: "postgresql://..." });
 */

import postgres from "postgres";
import type { DatabaseAdapter, QueryResult } from "./adapter.js";

export interface PostgresAdapterConfig {
  connectionString: string;
  poolSize?: number;
  idleTimeout?: number;
  ssl?: boolean;
}

/**
 * Create a Postgres-backed DatabaseAdapter.
 */
export function createPostgresAdapter(config: PostgresAdapterConfig): DatabaseAdapter {
  const sql = postgres(config.connectionString, {
    max: config.poolSize ?? 10,
    idle_timeout: config.idleTimeout ?? 30,
    ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
    transform: { undefined: null },
  });

  const adapter: DatabaseAdapter = {
    dialect: "postgres" as const,

    async query<T = Record<string, unknown>>(
      query: string,
      params: unknown[] = [],
    ): Promise<QueryResult<T>> {
      // Convert ? placeholders to $1, $2, ... for Postgres
      let idx = 0;
      const pgQuery = query.replace(/\?/g, () => `$${++idx}`);
      const result = await sql.unsafe(pgQuery, params as never[]);
      return { rows: result as unknown as T[], rowCount: result.length };
    },

    async execute(query: string, params: unknown[] = []): Promise<number> {
      let idx = 0;
      const pgQuery = query.replace(/\?/g, () => `$${++idx}`);
      const result = await sql.unsafe(pgQuery, params as never[]);
      return result.count ?? 0;
    },

    async exec(query: string): Promise<void> {
      await sql.unsafe(query);
    },

    async transaction<T>(fn: (adapter: DatabaseAdapter) => Promise<T>): Promise<T> {
      const result = await sql.begin(async () => {
        return fn(adapter) as Promise<T>;
      });
      return result as T;
    },

    async close(): Promise<void> {
      await sql.end();
    },
  };

  return adapter;
}
