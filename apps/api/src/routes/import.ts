import type { FastifyInstance } from "fastify";
import path from "node:path";
import fs from "node:fs";
import { importArtifacts } from "@warplane/ingest";
import { listImports } from "@warplane/storage";

export function registerImportRoutes(app: FastifyInstance): void {
  app.post("/api/v1/import", {
    schema: {
      description: "Import artifacts from a local directory",
      tags: ["ingest"],
      body: {
        type: "object",
        required: ["artifactsDir"],
        properties: {
          artifactsDir: { type: "string", description: "Absolute or relative path to artifacts directory" },
          sourceType: { type: "string", default: "manual" },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            importId: { type: "integer" },
            networks: { type: "integer" },
            chains: { type: "integer" },
            scenarios: { type: "integer" },
            traces: { type: "integer" },
            events: { type: "integer" },
            errors: { type: "array", items: { type: "string" } },
          },
        },
        400: {
          type: "object",
          properties: {
            error: { type: "string" },
          },
        },
      },
    },
  }, async (request, reply) => {
    const body = request.body as { artifactsDir: string; sourceType?: string };
    const resolved = path.resolve(body.artifactsDir);

    if (!fs.existsSync(resolved)) {
      return reply.status(400).send({ error: `Directory not found: ${body.artifactsDir}` });
    }

    const result = importArtifacts(app.db, {
      artifactsDir: resolved,
      sourceType: body.sourceType ?? "manual",
      log: (msg) => app.log.info(msg),
    });

    return result;
  });

  app.get("/api/v1/imports", {
    schema: {
      description: "List import history",
      tags: ["ingest"],
      response: {
        200: {
          type: "object",
          properties: {
            imports: { type: "array" },
          },
        },
      },
    },
  }, async () => {
    return { imports: listImports(app.db) };
  });
}
