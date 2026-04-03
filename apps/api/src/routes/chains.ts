import type { FastifyInstance } from "fastify";
import { listChains } from "@warplane/storage";

export function registerChainRoutes(app: FastifyInstance): void {
  app.get(
    "/api/v1/chains",
    {
      schema: {
        description: "List all registered chains",
        tags: ["registry"],
        response: {
          200: {
            type: "object",
            properties: {
              chains: { type: "array", items: { $ref: "ChainRegistryEntry" } },
            },
          },
        },
      },
    },
    async () => {
      return { chains: await listChains(app.db) };
    },
  );
}
