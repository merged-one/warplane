import type { ChainMeta, MessageTrace } from "@warplane/domain";
import { listTracesNeedingChainRepair, upsertTrace, type DatabaseAdapter } from "@warplane/storage";
import type { ChainRegistry } from "./types.js";
import {
  createChainResolver,
  cloneChainMeta,
  isRawBlockchainId,
  type ChainResolver,
} from "./chain-resolver.js";

export interface ChainRepairOptions {
  limit?: number;
}

export interface ChainRepairResult {
  scanned: number;
  repaired: number;
}

const UNKNOWN_CHAIN_NAME = "unknown";

export async function repairCanonicalTraceChains(
  db: DatabaseAdapter,
  chainRegistry?: ChainRegistry,
  options?: ChainRepairOptions,
): Promise<ChainRepairResult> {
  const traces = await listTracesNeedingChainRepair(db, {
    limit: options?.limit ?? 1_000,
  });
  const chainResolver = createChainResolver(chainRegistry);
  let repaired = 0;

  for (const trace of traces) {
    const nextTrace = repairTraceChains(trace, chainResolver);
    if (!nextTrace) continue;

    await upsertTrace(db, nextTrace);
    repaired++;
  }

  return {
    scanned: traces.length,
    repaired,
  };
}

function repairTraceChains(trace: MessageTrace, chainResolver: ChainResolver): MessageTrace | null {
  const nextTrace = cloneTrace(trace);
  let changed = false;

  changed =
    applyResolvedChain(nextTrace, "source", nextTrace.source.blockchainId, chainResolver) ||
    changed;
  changed =
    applyResolvedChain(
      nextTrace,
      "destination",
      nextTrace.destination.blockchainId,
      chainResolver,
    ) || changed;

  for (const event of nextTrace.events) {
    const details = parseDetails(event.details);
    if (!details) continue;

    if (needsRepair(nextTrace.source)) {
      changed =
        applyResolvedChain(nextTrace, "source", details.sourceBlockchainID, chainResolver) ||
        changed;
    }

    if (needsRepair(nextTrace.destination)) {
      changed =
        applyResolvedChain(
          nextTrace,
          "destination",
          details.destinationBlockchainID,
          chainResolver,
        ) || changed;
    }
  }

  return changed ? nextTrace : null;
}

function cloneTrace(trace: MessageTrace): MessageTrace {
  return {
    ...trace,
    source: { ...trace.source },
    destination: { ...trace.destination },
    timestamps: { ...trace.timestamps },
    events: trace.events.map((event) => ({ ...event })),
    relayer: trace.relayer ? { ...trace.relayer } : undefined,
    fee: trace.fee ? { ...trace.fee } : undefined,
    retry: trace.retry ? { ...trace.retry } : undefined,
    artifacts: trace.artifacts?.map((artifact) => ({ ...artifact })),
    rawRefs: trace.rawRefs ? [...trace.rawRefs] : undefined,
  };
}

function needsRepair(chain: ChainMeta): boolean {
  return (
    !chain.blockchainId ||
    isRawBlockchainId(chain.blockchainId) ||
    chain.name === UNKNOWN_CHAIN_NAME ||
    chain.name === chain.blockchainId
  );
}

function applyResolvedChain(
  trace: MessageTrace,
  side: "source" | "destination",
  blockchainId: unknown,
  chainResolver: ChainResolver,
): boolean {
  if (typeof blockchainId !== "string" || !blockchainId) return false;

  const resolved = chainResolver.getChainMeta(blockchainId);
  if (!resolved) return false;

  const current = side === "source" ? trace.source : trace.destination;
  if (!shouldReplaceChain(current, resolved)) return false;

  if (side === "source") {
    trace.source = cloneChainMeta(resolved);
  } else {
    trace.destination = cloneChainMeta(resolved);
  }

  return true;
}

function shouldReplaceChain(current: ChainMeta, next: ChainMeta): boolean {
  if (!current.blockchainId) return true;
  if (current.blockchainId === next.blockchainId) {
    return (
      current.name !== next.name ||
      current.subnetId !== next.subnetId ||
      current.evmChainId !== next.evmChainId
    );
  }
  return isRawBlockchainId(current.blockchainId);
}

function parseDetails(details: string | undefined): Record<string, unknown> | undefined {
  if (!details) return undefined;

  try {
    const parsed = JSON.parse(details) as Record<string, unknown>;
    return parsed && typeof parsed === "object" ? parsed : undefined;
  } catch {
    return undefined;
  }
}
