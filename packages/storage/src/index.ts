import type { ChainId, ChainStatus } from "@warplane/domain";

/** Read-side interface for chain status storage. */
export interface ChainStatusReader {
  get(chain: ChainId): Promise<ChainStatus | undefined>;
}

/** Write-side interface for chain status storage. */
export interface ChainStatusWriter {
  put(status: ChainStatus): Promise<void>;
}

/** Combined storage interface. */
export type ChainStatusStore = ChainStatusReader & ChainStatusWriter;
