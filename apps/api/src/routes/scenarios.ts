import type { FastifyInstance } from "fastify";
import { listScenarioRuns } from "@warplane/storage";

export function registerScenarioRoutes(app: FastifyInstance): void {
  app.get(
    "/api/v1/scenarios",
    {
      schema: {
        description: "List all scenario runs",
        tags: ["scenarios"],
        response: {
          200: {
            type: "object",
            properties: {
              scenarios: { type: "array", items: { $ref: "ScenarioRun" } },
            },
          },
        },
      },
    },
    async () => {
      return { scenarios: listScenarioRuns(app.db) };
    },
  );
}
