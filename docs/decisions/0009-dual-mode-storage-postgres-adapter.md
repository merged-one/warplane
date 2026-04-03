# ADR-0009: Dual-Mode Storage with Postgres Adapter

## Status

Accepted

## Date

2026-04-02

## Context and Problem Statement

Warplane's storage layer currently uses better-sqlite3 exclusively. All repository
functions (`upsertTrace`, `getCheckpoint`, etc.) take a synchronous `Database` handle
and call `db.prepare().run/get/all()` directly. Stage 4 of Milestone 2 requires adding
Postgres support for production deployments while keeping SQLite for local development.

The fundamental challenge: better-sqlite3 is **synchronous** (returns values directly)
while every Postgres driver for Node.js is **asynchronous** (returns Promises). This
sync/async boundary affects every repository function and every call site.

## Decision Drivers

- 8 existing repository modules all use synchronous better-sqlite3 API
- Production deployments need Postgres for durability, connection pooling, and multi-process access
- SQLite must remain the default for local dev (zero-config, `pnpm dev` just works)
- New tables (health snapshots, webhooks) are time-series/operational — Postgres excels here
- Minimal disruption to existing synchronous code paths
- Ponder project uses a similar SQLite-dev/Postgres-prod pattern successfully

## Considered Options

1. **Thin synchronous adapter** — Keep all repos synchronous, Postgres adapter wraps async
   driver with `deasync` or worker threads to present synchronous API
2. **Full async migration** — Convert all repository functions to async, wrap better-sqlite3
   in Promise.resolve() for compatibility
3. **New repos async only** — Keep existing repos synchronous for SQLite, add new
   health/webhook repos as async with DatabaseAdapter interface, migrate existing repos
   incrementally

## Decision Outcome

**Chosen option: 3 — New repos async only, incremental migration**

New repository modules (relayer-health, sigagg-health, webhooks) use an async
`DatabaseAdapter` interface from the start. Existing repos continue to use the
synchronous better-sqlite3 `Database` type unchanged. A `SqliteAdapter` wraps
better-sqlite3 in the async interface. A `PostgresAdapter` implements the same
interface using the `postgres` (porsager) driver.

### Consequences

**Good:**

- Zero disruption to existing synchronous repos and their call sites
- New code starts with the right abstraction from day one
- Existing repos can be migrated to the adapter incrementally (not a big-bang rewrite)
- `DATABASE_URL` env var switches backends transparently for new repos

**Bad:**

- Two patterns coexist temporarily (sync `Database` + async `DatabaseAdapter`)
- Existing repos only work with SQLite until individually migrated
- Slightly more complex type surface in the storage package

**Neutral:**

- Migration 003 SQL files are maintained in two directories (`migrations/` for SQLite,
  `migrations-pg/` for Postgres) since DDL syntax differs (SERIAL vs INTEGER PRIMARY KEY,
  TIMESTAMPTZ vs TEXT, JSONB vs TEXT)

## Detailed Decisions

### Postgres driver: `postgres` (porsager)

Chosen over `pg` (node-postgres) for:

- 2-5x faster query performance in benchmarks
- Tagged template literal API (`sql\`SELECT ...\``) prevents SQL injection by design
- Built-in connection pooling (no separate `pg-pool` package)
- ESM-native, TypeScript-friendly
- Used by Drizzle ORM internally; well-maintained

### Migration strategy: dual directories

SQLite migrations in `migrations/`, Postgres in `migrations-pg/`. Same logical schema,
dialect-specific DDL:

- SQLite: `INTEGER PRIMARY KEY`, `TEXT` for timestamps/JSON, `datetime('now')`
- Postgres: `SERIAL PRIMARY KEY`, `TIMESTAMPTZ`, `JSONB`, `NOW()`, BRIN indexes

### Health snapshot tables: append-only time-series

`relayer_health` and `sigagg_health` are append-only. Each scrape interval inserts a new
row. BRIN indexes on `created_at` are optimal for Postgres (10x smaller than B-tree for
monotonically increasing values). SQLite uses standard B-tree indexes.

### Webhook delivery: at-least-once semantics

`webhook_deliveries` tracks delivery state with exponential backoff retry. Status
lifecycle: `pending -> delivered | failed -> exhausted`. Partial indexes on
`(status, next_retry_at)` for efficient retry polling.

## Links

- [Milestone 2 Plan, Stage 4](../planning/milestone-2-plan.md) (lines 872-1028)
- [ADR-0005: RPC-first multi-source ingestion](0005-rpc-first-multi-source-ingestion.md)
- [postgres (porsager) — GitHub](https://github.com/porsager/postgres)
- [Ponder — dual SQLite/Postgres pattern](https://ponder.sh/docs/getting-started/database)
