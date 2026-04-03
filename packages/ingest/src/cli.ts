#!/usr/bin/env node
/**
 * CLI entry point for artifact ingestion.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... node --import tsx src/cli.ts import <artifacts-dir>
 *   DATABASE_URL=postgresql://... node --import tsx src/cli.ts watch <artifacts-dir> [--interval <ms>]
 */

import { createPostgresAdapter, initSchema } from "@warplane/storage";
import { importArtifacts } from "./importer.js";
import { startWatcher } from "./watcher.js";

const args = process.argv.slice(2);
const command = args[0];
const artifactsDir = args[1];

function getFlag(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : undefined;
}

const databaseUrl = process.env["DATABASE_URL"];
if (!databaseUrl) {
  console.error("DATABASE_URL environment variable is required.");
  process.exit(1);
}

if (!command || !artifactsDir) {
  console.error("Usage:");
  console.error("  DATABASE_URL=... ingest import <artifacts-dir>");
  console.error("  DATABASE_URL=... ingest watch  <artifacts-dir> [--interval <ms>]");
  process.exit(1);
}

const db = createPostgresAdapter({ connectionString: databaseUrl });
await initSchema(db);

if (command === "import") {
  const result = await importArtifacts(db, { artifactsDir });
  await db.close();

  if (result.errors.length > 0) {
    console.error(`Completed with ${result.errors.length} error(s)`);
    process.exit(1);
  }
  process.exit(0);
} else if (command === "watch") {
  const intervalMs = Number(getFlag("--interval") ?? 5000);
  console.log(`Watching ${artifactsDir} every ${intervalMs}ms`);

  const { stop } = await startWatcher(db, { artifactsDir, intervalMs });

  process.on("SIGINT", async () => {
    stop();
    await db.close();
    process.exit(0);
  });
  process.on("SIGTERM", async () => {
    stop();
    await db.close();
    process.exit(0);
  });
} else {
  console.error(`Unknown command: ${command}`);
  process.exit(1);
}
