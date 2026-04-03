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
            },
          },
        },
      },
    },
    async () => {
      // Pipeline status is a stub for now — full implementation when
      // the ingestion service runs alongside the API server.
      return {
        status: "idle",
        traceCount: countTraces(app.db),
        uptime: process.uptime(),
      };
    },
  );
}
