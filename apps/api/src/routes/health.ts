import type { FastifyInstance } from "fastify";
import { countTraces } from "@warplane/storage";

export function registerHealthRoutes(app: FastifyInstance): void {
  const healthHandler = async () => ({
    status: "ok",
    uptime: process.uptime(),
    traceCount: await countTraces(app.db),
    demoMode: app.demoMode,
  });

  const schema = {
    description: "Health check",
    tags: ["system"],
    response: {
      200: {
        type: "object",
        properties: {
          status: { type: "string" },
          uptime: { type: "number" },
          traceCount: { type: "integer" },
          demoMode: { type: "boolean" },
        },
      },
    },
  };

  app.get("/health", { schema }, healthHandler);
  app.get("/healthz", { schema: { ...schema, hide: true } }, healthHandler);
}
