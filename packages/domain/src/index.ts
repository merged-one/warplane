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
