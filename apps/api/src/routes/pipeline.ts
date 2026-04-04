import type { FastifyInstance } from "fastify";
import { countTraces, listCheckpoints } from "@warplane/storage";

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
              chains: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    chainId: { type: "string" },
                    mode: { type: "string" },
                    lastBlock: { type: "integer" },
                    error: { type: ["string", "null"] },
                  },
                },
              },
              stats: { type: "object", additionalProperties: true },
            },
          },
        },
      },
    },
    async () => {
      const [traceCount, checkpoints] = await Promise.all([
        countTraces(app.db),
        listCheckpoints(app.db),
      ]);
      const uptime = process.uptime();
      const checkpointByChainId = new Map(
        checkpoints.map((checkpoint) => [checkpoint.chainId, checkpoint]),
      );
      const localStatuses = app.orchestrator?.status() ?? [];
      const localStatusByChainId = new Map(localStatuses.map((status) => [status.chainId, status]));
      const chainIds = [
        ...new Set([
          ...checkpoints.map((checkpoint) => checkpoint.chainId),
          ...localStatuses.map((status) => status.chainId),
        ]),
      ];

      if (chainIds.length > 0) {
        const chains = chainIds.map((chainId) => {
          const localStatus = localStatusByChainId.get(chainId);
          const checkpoint = checkpointByChainId.get(chainId);
          const localLastBlock = localStatus ? Number(localStatus.lastBlock) : 0;
          const checkpointLastBlock = checkpoint?.lastBlock ?? 0;

          return {
            chainId,
            mode: localStatus?.mode ?? (checkpoint ? "backfill" : "stopped"),
            lastBlock: Math.max(localLastBlock, checkpointLastBlock),
            error: localStatus?.error ?? null,
          };
        });
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
