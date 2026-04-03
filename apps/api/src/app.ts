/**
 * Application factory — builds and configures the Fastify instance.
 *
 * Separated from index.ts so integration tests can create instances
 * without binding to a port.
 */

import Fastify, { type FastifyInstance } from "fastify";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUI from "@fastify/swagger-ui";
import fastifyStatic from "@fastify/static";
import path from "node:path";
import fs from "node:fs";
import { generateOpenAPIComponents } from "@warplane/domain";
import {
  createPostgresAdapter,
  initSchema,
  countTraces,
  upsertChain,
  type DatabaseAdapter,
} from "@warplane/storage";
import {
  importArtifacts,
  createPipeline,
  createAlertEvaluator,
  createDeliveryEngine,
  createStaleDetector,
  createOrchestrator,
  createRpcClient,
  type Pipeline,
  type Orchestrator,
} from "@warplane/ingest";
import { registerRoutes } from "./routes/index.js";
import type { WarplaneConfig, ChainYaml } from "./config.js";

export interface AppOptions {
  /** DATABASE_URL connection string for Postgres. */
  databaseUrl?: string;
  /** Pre-built DatabaseAdapter (for tests). Takes precedence over databaseUrl. */
  adapter?: DatabaseAdapter;
  /** Enable demo-mode auto-seeding from golden fixtures (default: true) */
  demoMode?: boolean;
  /** Fastify logger config (default: true) */
  logger?: boolean | object;
  /** Chain and service configuration (from YAML/env) */
  config?: WarplaneConfig;
}

declare module "fastify" {
  interface FastifyInstance {
    db: DatabaseAdapter;
    demoMode: boolean;
    orchestrator?: Orchestrator;
    pipeline?: Pipeline;
  }
}

const FIXTURES_DIR = path.resolve(
  import.meta.dirname ?? new URL(".", import.meta.url).pathname,
  "../../../harness/tmpnet/artifacts",
);

export async function buildApp(opts: AppOptions = {}): Promise<FastifyInstance> {
  const logger = opts.logger ?? true;

  const app = Fastify({ logger });

  // --- Database setup ---
  const db =
    opts.adapter ??
    createPostgresAdapter({
      connectionString:
        opts.databaseUrl ?? process.env["DATABASE_URL"] ?? "postgresql://localhost/warplane",
    });

  // Only init schema if we created the adapter ourselves (not for test-provided adapters).
  // Test adapters are expected to have their schema already initialized.
  if (!opts.adapter) {
    await initSchema(db);
  }
  app.decorate("db", db);
  app.decorate("demoMode", opts.demoMode ?? false);

  app.addHook("onClose", async () => {
    if (app.orchestrator) await app.orchestrator.stop();
    if (app.pipeline) app.pipeline.stop();
    await db.close();
  });

  // --- Demo-mode auto-seed ---
  const demoMode = opts.demoMode ?? true;
  if (demoMode && (await countTraces(db)) === 0 && fs.existsSync(FIXTURES_DIR)) {
    app.log.info("Demo mode: seeding golden fixtures…");
    const result = await importArtifacts(db, {
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
  app.get(
    "/openapi.json",
    {
      schema: { hide: true },
    },
    async () => {
      return app.swagger();
    },
  );

  // --- Ingestion pipeline & orchestrator ---
  const chainConfig = opts.config?.chains ?? [];
  if (chainConfig.length > 0) {
    app.log.info(`Configuring ingestion for ${chainConfig.length} chain(s)…`);

    // Register configured chains in the database so the UI chain dropdown works
    for (const chain of chainConfig) {
      await upsertChain(db, {
        name: chain.name,
        blockchainId: chain.blockchainId,
        subnetId: "",
        evmChainId: chain.evmChainId ?? 0,
        teleporterAddress: chain.teleporterAddress,
        rpcUrl: chain.rpcUrl,
      });
    }

    // Alert & delivery subsystem
    const deliveryEngine = createDeliveryEngine(db);
    deliveryEngine.start(30_000); // process delivery queue every 30s

    const alertEvaluator = createAlertEvaluator(db, deliveryEngine);
    const staleDetector = createStaleDetector(db, deliveryEngine);
    staleDetector.start(60_000); // scan for stale messages every 60s

    // Pipeline with alert integration
    const pipeline = createPipeline(db, { alertEvaluator });
    app.decorate("pipeline", pipeline);

    // Create RPC clients for each chain
    const rpcClients = new Map<string, ReturnType<typeof createRpcClient>>();
    for (const chain of chainConfig) {
      rpcClients.set(
        chain.blockchainId,
        createRpcClient({
          name: chain.name,
          rpcUrl: chain.rpcUrl,
          wsUrl: chain.wsUrl,
        }),
      );
    }

    // Create orchestrator
    const orchestrator = createOrchestrator(db, rpcClients, {
      chains: chainConfig.map((c: ChainYaml) => ({
        chainId: c.blockchainId,
        contractAddress: c.teleporterAddress,
        startBlock: c.startBlock != null ? BigInt(c.startBlock) : undefined,
      })),
      onEvents: (chainId, events) => pipeline.handleEvents(chainId, events),
    });
    app.decorate("orchestrator", orchestrator);

    // Start orchestrator in background (don't await — it runs continuously)
    orchestrator.start().catch((err) => {
      app.log.error(err, "Orchestrator start failed");
    });
  }

  // --- Static file serving (production: serve web frontend) ---
  const thisDir = import.meta.dirname ?? new URL(".", import.meta.url).pathname;
  const candidates = [
    path.resolve(thisDir, "../../web/dist"), // monorepo layout
    path.resolve(thisDir, "../apps/web/dist"), // pnpm deploy layout
  ];
  const webDistDir = candidates.find((d) => fs.existsSync(d));

  if (webDistDir) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await app.register(fastifyStatic as any, {
      root: webDistDir,
      prefix: "/",
      wildcard: false,
      decorateReply: true,
    });

    // SPA fallback — serve index.html for non-API, non-file routes
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith("/api/")) {
        return reply.code(404).send({ error: "Not found" });
      }
      return reply.sendFile("index.html");
    });
  }

  return app;
}
