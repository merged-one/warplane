/**
 * Registry schemas for chains, apps, and network manifests.
 *
 * These describe the static topology of an Avalanche network deployment:
 * which chains exist, what contracts are deployed, and how they connect.
 *
 * @module registry
 * @version 1.0.0
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Chain registry entry
// ---------------------------------------------------------------------------

export const ChainRegistryEntry = z.object({
  name: z.string(),
  blockchainId: z.string(),
  subnetId: z.string(),
  evmChainId: z.number().int(),
  nodeUris: z.array(z.string().url()).optional(),
  teleporterAddress: z.string().optional(),
  teleporterRegistryAddress: z.string().optional(),
  rpcUrl: z.string().url().optional(),
  explorerUrl: z.string().url().optional(),
});
export type ChainRegistryEntry = z.infer<typeof ChainRegistryEntry>;

// ---------------------------------------------------------------------------
// App registry entry (contracts / dApps deployed across chains)
// ---------------------------------------------------------------------------

export const AppRegistryEntry = z.object({
  name: z.string(),
  version: z.string().optional(),
  description: z.string().optional(),
  chains: z.array(
    z.object({
      blockchainId: z.string(),
      contractAddress: z.string(),
      deployTxHash: z.string().optional(),
    }),
  ),
});
export type AppRegistryEntry = z.infer<typeof AppRegistryEntry>;

// ---------------------------------------------------------------------------
// Network manifest (describes a full deployment environment)
// ---------------------------------------------------------------------------

export const NetworkManifest = z.object({
  schemaVersion: z.string().default("1.0.0"),
  networkDir: z.string().optional(),
  networkId: z.number().int(),
  source: ChainRegistryEntry,
  destination: ChainRegistryEntry,
  pChainNodeUris: z.array(z.string()).optional(),
  teleporterVersion: z.string().optional(),
  chains: z.array(ChainRegistryEntry).optional(),
  apps: z.array(AppRegistryEntry).optional(),
});
export type NetworkManifest = z.infer<typeof NetworkManifest>;
