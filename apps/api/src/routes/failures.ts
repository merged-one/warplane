import type { FastifyInstance } from "fastify";
import { listTraces } from "@warplane/storage";

export function registerFailureRoutes(app: FastifyInstance): void {
  app.get(
    "/api/v1/failures",
    {
      schema: {
        description: "List traces with non-success execution status",
        tags: ["traces"],
        querystring: {
          type: "object",
          properties: {
            scenario: { type: "string" },
            page: { type: "integer", minimum: 1, default: 1 },
            pageSize: { type: "integer", minimum: 1, maximum: 200, default: 50 },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              failures: { type: "array", items: { $ref: "MessageTrace" } },
            },
          },
        },
      },
    },
    async (request) => {
      const q = request.query as { scenario?: string; page?: number; pageSize?: number };
      const page = q.page ?? 1;
      const pageSize = q.pageSize ?? 50;

      // Get non-success traces: failed, replay_blocked, pending
      const failedTraces = listTraces(app.db, {
        scenario: q.scenario,
        execution: "failed",
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });

      const replayBlocked = listTraces(app.db, {
        scenario: q.scenario,
        execution: "replay_blocked",
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });

      const pending = listTraces(app.db, {
        scenario: q.scenario,
        execution: "pending",
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });

      const failures = [...failedTraces, ...replayBlocked, ...pending];

      return { failures };
    },
  );
}
