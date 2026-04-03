import type { FastifyInstance } from "fastify";
import { countTraces } from "@warplane/storage";

export function registerPipelineRoutes(app: FastifyInstance): void {
  app.get(
    "/api/v1/pipeline/status",
    {
      schema: {
        description: "Ingestion pipeline status and sync information",
        tags: ["pipeline"],
        response: {
          200: {
            type: "object",
            properties: {
              status: { type: "string" },
              traceCount: { type: "integer" },
              uptime: { type: "number" },
              chains: { type: "array", items: { type: "object" } },
              stats: { type: "object" },
            },
          },
        },
      },
    },
    async () => {
      const traceCount = await countTraces(app.db);
      const uptime = process.uptime();

      if (app.orchestrator) {
        const chains = app.orchestrator.status().map((c) => ({
          chainId: c.chainId,
          mode: c.mode,
          lastBlock: Number(c.lastBlock),
          error: c.error ?? null,
        }));
        const stats = app.pipeline?.stats() ?? {};

        return {
          status: "running",
          traceCount,
          uptime,
          chains,
          stats,
        };
      }

      return {
        status: "idle",
        traceCount,
        uptime,
        chains: [],
        stats: {},
      };
    },
  );
}
