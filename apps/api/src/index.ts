/**
 * @warplane/api — Fastify REST API for the Interchain Control Plane.
 *
 * Serves traces, chains, networks, and scenarios from the local
 * SQLite database. Supports demo-mode auto-seeding from golden fixtures.
 */

import { buildApp } from "./app.js";

const port = Number(process.env["PORT"] ?? 3100);
const host = process.env["HOST"] ?? "0.0.0.0";
const demoMode = process.env["DEMO_MODE"] !== "false";

const app = await buildApp({ demoMode });

try {
  await app.listen({ port, host });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
