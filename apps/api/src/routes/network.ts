import type { FastifyInstance } from "fastify";
import { listNetworks } from "@warplane/storage";

export function registerNetworkRoutes(app: FastifyInstance): void {
  app.get(
    "/api/v1/network",
    {
      schema: {
        description: "Get all registered networks",
        tags: ["registry"],
        response: {
          200: {
            type: "object",
            properties: {
              networks: { type: "array", items: { $ref: "NetworkManifest" } },
            },
          },
        },
      },
    },
    async () => {
      return { networks: listNetworks(app.db) };
    },
  );
}
