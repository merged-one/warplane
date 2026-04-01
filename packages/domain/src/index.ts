/**
 * @warplane/domain -- canonical domain model for the Interchain Control Plane.
 *
 * Single source of truth for types, runtime validation, JSON Schema,
 * and OpenAPI components shared across API, CLI, UI, docs, and MCP server.
 *
 * @version 1.0.0
 */

// -- Legacy types (retained for backward compatibility) ---------------------

/** Identifies a chain by its blockchain ID on the Avalanche Primary Network. */
export interface ChainId {
  readonly blockchainId: string;
}

/** Represents an Avalanche L1 subnet with its associated chains. */
export interface Subnet {
  readonly subnetId: string;
  readonly name: string;
  readonly chains: ChainId[];
}

/** Health status of a monitored chain. */
export type HealthStatus = "healthy" | "degraded" | "down" | "unknown";

/** Snapshot of a chain's current operational state. */
export interface ChainStatus {
  readonly chain: ChainId;
  readonly health: HealthStatus;
  readonly blockHeight: bigint;
  readonly timestamp: Date;
}

/** Creates a ChainId from a blockchain ID string. */
export function chainId(blockchainId: string): ChainId {
  if (!blockchainId) throw new Error("blockchainId must be non-empty");
  return { blockchainId };
}

// -- Canonical domain schemas -----------------------------------------------

export * from "./events.js";
export * from "./trace.js";
export * from "./registry.js";
export * from "./scenarios.js";
export * from "./json-schema.js";
export * from "./openapi.js";
