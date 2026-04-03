/**
 * @warplane/api — Fastify REST API for the Interchain Control Plane.
 *
 * Serves traces, chains, networks, and scenarios from the local
 * SQLite database. Supports demo-mode auto-seeding from golden fixtures.
 */

import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";

const config = loadConfig();
const port = Number(process.env["PORT"] ?? config.port ?? 3000);
const host = process.env["HOST"] ?? "0.0.0.0";
const demoMode = process.env["DEMO_MODE"] !== "false";
const dbPath = config.database?.path ?? process.env["DB_PATH"];

const app = await buildApp({ demoMode, config, ...(dbPath ? { dbPath } : {}) });

try {
  await app.listen({ port, host });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
