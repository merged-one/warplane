/**
 * JSON Schema generation from Zod v4 schemas.
 *
 * Uses Zod v4's built-in `z.toJSONSchema()` to convert all canonical
 * domain schemas to JSON Schema (compatible with draft 2020-12 / OpenAPI 3.1).
 *
 * @module json-schema
 * @version 1.0.0
 */

import { z } from "zod";
import { MessageTrace, TraceIndex, TraceIndexEntry } from "./trace.js";
import { MessageEvent, MessageEventKind } from "./events.js";
import { NetworkManifest, ChainRegistryEntry, AppRegistryEntry } from "./registry.js";
import { ScenarioRun } from "./scenarios.js";

export interface DomainJsonSchemas {
  MessageTrace: Record<string, unknown>;
  TraceIndex: Record<string, unknown>;
  TraceIndexEntry: Record<string, unknown>;
  MessageEvent: Record<string, unknown>;
  MessageEventKind: Record<string, unknown>;
  NetworkManifest: Record<string, unknown>;
  ChainRegistryEntry: Record<string, unknown>;
  AppRegistryEntry: Record<string, unknown>;
  ScenarioRun: Record<string, unknown>;
}

/** Generate all domain JSON Schemas using Zod v4's built-in conversion. */
export function generateJsonSchemas(): DomainJsonSchemas {
  return {
    MessageTrace: z.toJSONSchema(MessageTrace, { target: "jsonSchema7" }),
    TraceIndex: z.toJSONSchema(TraceIndex, { target: "jsonSchema7" }),
    TraceIndexEntry: z.toJSONSchema(TraceIndexEntry, {
      target: "jsonSchema7",
    }),
    MessageEvent: z.toJSONSchema(MessageEvent, { target: "jsonSchema7" }),
    MessageEventKind: z.toJSONSchema(MessageEventKind, {
      target: "jsonSchema7",
    }),
    NetworkManifest: z.toJSONSchema(NetworkManifest, {
      target: "jsonSchema7",
    }),
    ChainRegistryEntry: z.toJSONSchema(ChainRegistryEntry, {
      target: "jsonSchema7",
    }),
    AppRegistryEntry: z.toJSONSchema(AppRegistryEntry, {
      target: "jsonSchema7",
    }),
    ScenarioRun: z.toJSONSchema(ScenarioRun, { target: "jsonSchema7" }),
  };
}
