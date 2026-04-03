import type { FastifyInstance } from "fastify";
import { countTraces } from "@warplane/storage";

export function registerHealthRoutes(app: FastifyInstance): void {
  app.get(
    "/health",
    {
      schema: {
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
      },
    },
    async () => {
      return {
        status: "ok",
        uptime: process.uptime(),
        traceCount: await countTraces(app.db),
        demoMode: app.demoMode,
      };
    },
  );

  // Keep legacy healthz for backward compat
  app.get("/healthz", { schema: { hide: true } }, async () => ({ status: "ok" }));
}
