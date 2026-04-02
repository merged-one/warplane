/**
 * RPC ingestion engine — barrel export.
 *
 * Provides everything needed to ingest TeleporterMessenger events
 * from Avalanche L1 RPC endpoints.
 */

// ABI & constants
export { teleporterMessengerAbi, TELEPORTER_MESSENGER_ADDRESS } from "./abi.js";

// Decoder
export {
  decodeTeleporterLog,
  decodeTeleporterLogs,
  type RawLog,
  type LogMeta,
  type TeleporterEvent,
} from "./decoder.js";

// Block tracker
export { BlockTracker, type BlockHeader, type ReorgResult } from "./block-tracker.js";

// RPC client
export { createRpcClient, type RpcClient, type RpcClientConfig } from "./client.js";

// Event fetcher
export { fetchTeleporterEvents, type FetcherConfig, type FetchResult } from "./fetcher.js";

// Orchestrator
export {
  createOrchestrator,
  type Orchestrator,
  type OrchestratorConfig,
  type ChainConfig,
  type ChainStatus,
  type ChainMode,
} from "./orchestrator.js";
