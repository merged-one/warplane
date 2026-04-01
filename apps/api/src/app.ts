/**
 * Application factory — builds and configures the Fastify instance.
 *
 * Separated from index.ts so integration tests can create instances
 * without binding to a port.
 */

import Fastify, { type FastifyInstance } from "fastify";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUI from "@fastify/swagger-ui";
import path from "node:path";
import fs from "node:fs";
import { generateOpenAPIComponents } from "@warplane/domain";
import { openDb, runMigrations, closeDb, countTraces, type Database } from "@warplane/storage";
import { importArtifacts } from "@warplane/ingest";
import { registerRoutes } from "./routes/index.js";

export interface AppOptions {
  /** SQLite database path. Defaults to data/warplane.db */
  dbPath?: string;
  /** Enable demo-mode auto-seeding from golden fixtures (default: true) */
  demoMode?: boolean;
  /** Fastify logger config (default: true) */
  logger?: boolean | object;
}

declare module "fastify" {
  interface FastifyInstance {
    db: Database;
  }
}

const FIXTURES_DIR = path.resolve(
  import.meta.dirname ?? new URL(".", import.meta.url).pathname,
  "../../../harness/tmpnet/artifacts",
);

export async function buildApp(opts: AppOptions = {}): Promise<FastifyInstance> {
  const dbPath = opts.dbPath ?? process.env["DB_PATH"] ?? "data/warplane.db";
  const logger = opts.logger ?? true;

  const app = Fastify({ logger });

  // --- Database setup ---
  if (dbPath !== ":memory:") {
    const dir = path.dirname(path.resolve(dbPath));
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  const db = openDb({ path: dbPath });
  runMigrations(db);
  app.decorate("db", db);

  app.addHook("onClose", () => {
    closeDb(db);
  });

  // --- Demo-mode auto-seed ---
  const demoMode = opts.demoMode ?? true;
  if (demoMode && countTraces(db) === 0 && fs.existsSync(FIXTURES_DIR)) {
    app.log.info("Demo mode: seeding golden fixtures…");
    const result = importArtifacts(db, {
      artifactsDir: FIXTURES_DIR,
      sourceType: "demo-seed",
      log: (msg) => app.log.info(msg),
    });
    app.log.info(
      `Seeded ${result.traces} traces, ${result.scenarios} scenarios, ${result.networks} networks`,
    );
  }

  // --- OpenAPI / Swagger ---
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await app.register(fastifySwagger as any, {
    openapi: {
      openapi: "3.1.0",
      info: {
        title: "Warplane Control Plane API",
        description: "Local REST API for the Interchain Control Plane for Avalanche L1s",
        version: "0.1.0",
      },
      components: generateOpenAPIComponents().components,
    },
  });

  await app.register(fastifySwaggerUI, {
    routePrefix: "/docs",
  });

  // --- Register domain schemas for $ref resolution ---
  const domainSchemas = generateOpenAPIComponents().components.schemas;
  for (const [name, schema] of Object.entries(domainSchemas)) {
    app.addSchema({ $id: name, ...(schema as Record<string, unknown>) });
  }

  // --- Routes ---
  registerRoutes(app);

  // --- OpenAPI JSON endpoint ---
  app.get("/openapi.json", {
    schema: { hide: true },
  }, async () => {
    return app.swagger();
  });

  return app;
}
