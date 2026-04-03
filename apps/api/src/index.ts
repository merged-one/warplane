/**
 * @warplane/api — Fastify REST API for the Interchain Control Plane.
 *
 * Serves traces, chains, networks, and scenarios from Postgres.
 * Supports demo-mode auto-seeding from golden fixtures.
 */

import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";

const config = loadConfig();
const port = Number(process.env["PORT"] ?? config.port ?? 3000);
const host = process.env["HOST"] ?? "0.0.0.0";
const demoMode = process.env["DEMO_MODE"] === "true";
const databaseUrl = process.env["DATABASE_URL"] ?? config.database?.url;

const app = await buildApp({ demoMode, config, ...(databaseUrl ? { databaseUrl } : {}) });

try {
  await app.listen({ port, host });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
