/**
 * DatabaseAdapter — async interface abstracting SQLite and Postgres.
 *
 * New repository modules use this interface. Existing synchronous repos
 * continue to use the better-sqlite3 Database type directly and will be
 * migrated incrementally (see ADR-0009).
 */

// ---------------------------------------------------------------------------
// Query result types
// ---------------------------------------------------------------------------

export interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount: number;
}

// ---------------------------------------------------------------------------
// Adapter interface
// ---------------------------------------------------------------------------

export interface DatabaseAdapter {
  /** Execute a parameterized query returning rows. */
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;

  /** Execute a statement (INSERT/UPDATE/DELETE) returning affected row count. */
  execute(sql: string, params?: unknown[]): Promise<number>;

  /** Execute raw SQL (DDL, multi-statement). */
  exec(sql: string): Promise<void>;

  /** Run a function inside a transaction. */
  transaction<T>(fn: (adapter: DatabaseAdapter) => Promise<T>): Promise<T>;

  /** Close the connection/pool. */
  close(): Promise<void>;

  /** Which backend is this? */
  readonly dialect: "sqlite" | "postgres";
}
