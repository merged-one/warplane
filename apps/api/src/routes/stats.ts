import type { FastifyInstance } from "fastify";
import { getFailureClassification, getDeliveryLatencyStats } from "@warplane/storage";

export function registerStatsRoutes(app: FastifyInstance): void {
  app.get(
    "/api/v1/stats/failures",
    {
      schema: {
        description: "Failure classification summary — execution_failed events grouped by reason",
        tags: ["stats"],
        querystring: {
          type: "object",
          properties: {
            since: { type: "string", description: "ISO timestamp lower bound (default: last 24h)" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              failures: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    reason: { type: "string" },
                    count: { type: "integer" },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request) => {
      const q = request.query as { since?: string };
      const since = q.since ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const failures = getFailureClassification(app.db, { since });
      return { failures };
    },
  );

  app.get(
    "/api/v1/stats/latency",
    {
      schema: {
        description: "Delivery latency percentiles and time-series for completed traces",
        tags: ["stats"],
        querystring: {
          type: "object",
          properties: {
            since: { type: "string", description: "ISO timestamp lower bound (default: last 24h)" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              p50: { type: "number" },
              p90: { type: "number" },
              p99: { type: "number" },
              timeSeries: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    time: { type: "string" },
                    latencyMs: { type: "number" },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request) => {
      const q = request.query as { since?: string };
      const since = q.since ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      return getDeliveryLatencyStats(app.db, { since });
    },
  );
}
