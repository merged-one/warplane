/**
 * Pipeline barrel export — normalization, correlation, and coordination.
 */

// Types
export type {
  MessageState,
  NormalizedEvent,
  CorrelationResult,
  PipelineStats,
  ChainRegistry,
} from "./types.js";
export { STATE_TRANSITIONS } from "./types.js";

// Normalizer
export { normalize } from "./normalizer.js";

// Correlator
export { createCorrelator, type Correlator } from "./correlator.js";

// Coordinator
export { createPipeline, type Pipeline, type PipelineConfig } from "./coordinator.js";
