import type { FastifyInstance } from "fastify";
import { getLatestSigAggHealth, listSigAggHealthHistory } from "@warplane/storage";

export function registerSigAggRoutes(app: FastifyInstance): void {
  app.get(
    "/api/v1/sigagg/health",
    {
      schema: {
        description: "Latest signature aggregator health snapshot",
        tags: ["sigagg"],
        response: {
          200: {
            type: "object",
            properties: {
              health: {
                type: ["object", "null"],
                properties: {
                  status: { type: "string" },
                  aggregationLatency: { type: ["number", "null"] },
                  connectedStake: { type: "object" },
                  cacheHitRate: { type: ["number", "null"] },
                  createdAt: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    async () => {
      const health = await getLatestSigAggHealth(app.db);
      return { health: health ?? null };
    },
  );

  app.get(
    "/api/v1/sigagg/health/history",
    {
      schema: {
        description: "Signature aggregator health time-series",
        tags: ["sigagg"],
        querystring: {
          type: "object",
          properties: {
            limit: { type: "integer", minimum: 1, maximum: 1000, default: 100 },
            since: { type: "string", description: "ISO timestamp lower bound" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              history: { type: "array", items: { type: "object" } },
            },
          },
        },
      },
    },
    async (request) => {
      const q = request.query as { limit?: number; since?: string };
      const history = await listSigAggHealthHistory(app.db, {
        limit: q.limit,
        since: q.since,
      });
      return { history };
    },
  );
}
