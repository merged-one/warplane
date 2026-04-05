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

type PostgresSql =
  | postgres.Sql<Record<string, unknown>>
  | postgres.TransactionSql<Record<string, unknown>>;

/**
 * Create a Postgres-backed DatabaseAdapter.
 */
export function createPostgresAdapter(config: PostgresAdapterConfig): DatabaseAdapter {
  // Cloud SQL connection strings use ?host=/cloudsql/... which Node's URL parser
  // rejects (no hostname between @ and /). Parse manually for the postgres driver.
  const connStr = config.connectionString;
  const hostMatch = connStr.match(/[?&]host=([^&]+)/);
  const isCloudSql = hostMatch && hostMatch[1]?.startsWith("/cloudsql/");

  let sqlOpts: Record<string, unknown> = {
    max: config.poolSize ?? 10,
    idle_timeout: config.idleTimeout ?? 30,
    ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
    transform: { undefined: null },
  };

  if (isCloudSql) {
    // Extract parts: postgresql://user:pass@/dbname?host=/cloudsql/...
    const userPassMatch = connStr.match(/postgresql:\/\/([^:]+):([^@]+)@/);
    const dbMatch = connStr.match(/@\/([^?]+)/);
    sqlOpts = {
      ...sqlOpts,
      host: hostMatch![1],
      username: userPassMatch?.[1] ?? "postgres",
      password: decodeURIComponent(userPassMatch?.[2] ?? ""),
      database: dbMatch?.[1] ?? "warplane",
    };
  }

  const sql = isCloudSql ? postgres(sqlOpts as never) : postgres(connStr, sqlOpts as never);
  return createAdapter(sql, async () => {
    await sql.end();
  });
}

function createAdapter(sql: PostgresSql, close: () => Promise<void>): DatabaseAdapter {
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
      if ("savepoint" in sql) {
        const result = await sql.savepoint(async (tx) => {
          return fn(createAdapter(tx, async () => {}));
        });
        return result as T;
      }

      const result = await sql.begin(async (tx) => {
        return fn(createAdapter(tx, async () => {}));
      });
      return result as T;
    },

    async close(): Promise<void> {
      await close();
    },
  };

  return adapter;
}
