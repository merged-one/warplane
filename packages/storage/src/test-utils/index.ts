/**
 * Test utilities for @warplane/storage.
 *
 * Provides an in-memory SQLite-backed DatabaseAdapter for fast unit tests.
 * Production code uses Postgres exclusively.
 */

export { createTestAdapter, initTestSchema, type TestDbOptions } from "./sqlite-adapter.js";
