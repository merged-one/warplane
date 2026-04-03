#!/usr/bin/env node
/**
 * CLI entry point for initializing the Postgres schema.
 * Usage: DATABASE_URL=postgresql://... node --import tsx src/cli-migrate.ts
 */

import { createPostgresAdapter } from "./postgres-adapter.js";
import { initSchema } from "./migrate.js";

const databaseUrl = process.env["DATABASE_URL"];
if (!databaseUrl) {
  console.error("DATABASE_URL environment variable is required.");
  process.exit(1);
}

console.log("Initializing schema...");
const adapter = createPostgresAdapter({ connectionString: databaseUrl });

try {
  await initSchema(adapter);
  console.log("Schema initialized successfully.");
} finally {
  await adapter.close();
}
