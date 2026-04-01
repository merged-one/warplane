/**
 * OpenAPI 3.1 component bundle generation.
 *
 * Produces a `components/schemas` object that the API package can
 * merge into its full OpenAPI spec. Uses the JSON Schema output
 * from our Zod schemas (JSON Schema draft 2020-12 is compatible
 * with OpenAPI 3.1).
 *
 * @module openapi
 * @version 1.0.0
 */

import { generateJsonSchemas } from "./json-schema.js";

export interface OpenAPIComponentBundle {
  openapi: "3.1.0";
  info: { title: string; version: string };
  paths: Record<string, never>;
  components: {
    schemas: Record<string, unknown>;
  };
}

/** Generate an OpenAPI 3.1 components-only bundle. */
export function generateOpenAPIComponents(): OpenAPIComponentBundle {
  const schemas = generateJsonSchemas();
  return {
    openapi: "3.1.0",
    info: {
      title: "Warplane Domain Schemas",
      version: "1.0.0",
    },
    paths: {},
    components: {
      schemas: {
        MessageTrace: schemas.MessageTrace,
        TraceIndex: schemas.TraceIndex,
        TraceIndexEntry: schemas.TraceIndexEntry,
        MessageEvent: schemas.MessageEvent,
        MessageEventKind: schemas.MessageEventKind,
        NetworkManifest: schemas.NetworkManifest,
        ChainRegistryEntry: schemas.ChainRegistryEntry,
        AppRegistryEntry: schemas.AppRegistryEntry,
        ScenarioRun: schemas.ScenarioRun,
      },
    },
  };
}
