import type { FastifyInstance } from "fastify";
import { listTraces, listChains, listScenarioRuns } from "@warplane/storage";

export function registerSearchRoutes(app: FastifyInstance): void {
  app.get(
    "/api/v1/search",
    {
      schema: {
        description: "Search traces, chains, and scenarios by keyword",
        tags: ["search"],
        querystring: {
          type: "object",
          required: ["q"],
          properties: {
            q: { type: "string", minLength: 1, description: "Search query" },
            limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              query: { type: "string" },
              traces: { type: "array", items: { $ref: "MessageTrace" } },
              chains: { type: "array", items: { $ref: "ChainRegistryEntry" } },
              scenarios: { type: "array", items: { $ref: "ScenarioRun" } },
            },
          },
        },
      },
    },
    async (request) => {
      const { q, limit } = request.query as { q: string; limit?: number };
      const maxResults = limit ?? 20;
      const query = q.toLowerCase();

      // Search traces — check message ID, scenario, sender, recipient
      const allTraces = await listTraces(app.db, { limit: 500 });
      const matchedTraces = allTraces
        .filter(
          (t) =>
            t.messageId.toLowerCase().includes(query) ||
            t.scenario.toLowerCase().includes(query) ||
            t.sender.toLowerCase().includes(query) ||
            t.recipient.toLowerCase().includes(query) ||
            t.execution.toLowerCase().includes(query) ||
            t.source.name.toLowerCase().includes(query) ||
            t.destination.name.toLowerCase().includes(query) ||
            t.source.blockchainId.toLowerCase().includes(query) ||
            t.destination.blockchainId.toLowerCase().includes(query),
        )
        .slice(0, maxResults);

      // Search chains
      const allChains = await listChains(app.db);
      const matchedChains = allChains
        .filter(
          (c) =>
            c.name.toLowerCase().includes(query) || c.blockchainId.toLowerCase().includes(query),
        )
        .slice(0, maxResults);

      // Search scenarios
      const allScenarios = await listScenarioRuns(app.db);
      const matchedScenarios = allScenarios
        .filter((s) => s.scenario.toLowerCase().includes(query))
        .slice(0, maxResults);

      return {
        query: q,
        traces: matchedTraces,
        chains: matchedChains,
        scenarios: matchedScenarios,
      };
    },
  );
}
