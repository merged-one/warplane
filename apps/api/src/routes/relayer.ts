import type { FastifyInstance } from "fastify";
import { getLatestRelayerHealth, listRelayerHealthHistory } from "@warplane/storage";

export function registerRelayerRoutes(app: FastifyInstance): void {
  app.get(
    "/api/v1/relayer/health",
    {
      schema: {
        description: "Latest relayer health snapshots (one per relayer)",
        tags: ["relayer"],
        response: {
          200: {
            type: "object",
            properties: {
              health: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    relayerId: { type: "string" },
                    status: { type: "string" },
                    successRate: { type: ["number", "null"] },
                    latencyMs: { type: ["number", "null"] },
                    lagBlocks: { type: ["number", "null"] },
                    pendingMessages: { type: ["number", "null"] },
                    topFailures: { type: "array", items: { type: "object" } },
                    createdAt: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
    async () => {
      // Get distinct relayer IDs from the health table
      const result = await app.db.query<{ relayer_id: string }>(
        `SELECT DISTINCT relayer_id FROM relayer_health ORDER BY relayer_id`,
      );
      const relayerIds = result.rows.map((r) => r.relayer_id);

      const health = [];
      for (const relayerId of relayerIds) {
        const latest = await getLatestRelayerHealth(app.db, relayerId);
        if (latest) health.push(latest);
      }

      return { health };
    },
  );

  app.get(
    "/api/v1/relayer/health/history",
    {
      schema: {
        description: "Relayer health time-series (last 24h by default)",
        tags: ["relayer"],
        querystring: {
          type: "object",
          properties: {
            relayerId: { type: "string", description: "Filter by relayer ID" },
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
      const q = request.query as { relayerId?: string; limit?: number; since?: string };

      // If no relayerId specified, get all relayers
      if (!q.relayerId) {
        const result = await app.db.query<{ relayer_id: string }>(
          `SELECT DISTINCT relayer_id FROM relayer_health ORDER BY relayer_id`,
        );
        const allHistory = [];
        for (const row of result.rows) {
          const history = await listRelayerHealthHistory(app.db, row.relayer_id, {
            limit: q.limit,
            since: q.since,
          });
          allHistory.push(...history);
        }
        return { history: allHistory };
      }

      const history = await listRelayerHealthHistory(app.db, q.relayerId, {
        limit: q.limit,
        since: q.since,
      });
      return { history };
    },
  );
}
