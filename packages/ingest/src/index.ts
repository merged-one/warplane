import type { ChainId, ChainStatus, HealthStatus } from "@warplane/domain";

/** Polls an Avalanche node for chain health. */
export async function pollChainHealth(chain: ChainId): Promise<ChainStatus> {
  const health: HealthStatus = "unknown";
  return {
    chain,
    health,
    blockHeight: 0n,
    timestamp: new Date(),
  };
}
