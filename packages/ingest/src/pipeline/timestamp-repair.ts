import type { MessageEvent, MessageTrace } from "@warplane/domain";
import {
  listTracesWithPlaceholderTimestamps,
  upsertTrace,
  type DatabaseAdapter,
} from "@warplane/storage";
import type { RpcClient } from "../rpc/client.js";

const PLACEHOLDER_TRACE_TIMESTAMP = "1970-01-01T00:00:00.000Z";
type ReceiveTimestampEvent = Extract<
  MessageEvent,
  { kind: "delivery_confirmed" | "execution_failed" | "retry_succeeded" }
>;

export interface TimestampRepairOptions {
  limit?: number;
}

export interface TimestampRepairResult {
  scanned: number;
  repaired: number;
}

type BlockHeaderReader = Pick<RpcClient, "getBlockHeader">;

export async function repairPlaceholderTraceTimestamps(
  db: DatabaseAdapter,
  rpcClients: ReadonlyMap<string, BlockHeaderReader>,
  options?: TimestampRepairOptions,
): Promise<TimestampRepairResult> {
  const traces = await listTracesWithPlaceholderTimestamps(db, {
    limit: options?.limit ?? 1_000,
  });
  const timestampCache = new Map<string, string>();
  let repaired = 0;

  for (const trace of traces) {
    const nextTrace = await repairTraceTimestamps(trace, rpcClients, timestampCache);
    if (!nextTrace) continue;

    await upsertTrace(db, nextTrace);
    repaired++;
  }

  return {
    scanned: traces.length,
    repaired,
  };
}

async function repairTraceTimestamps(
  trace: MessageTrace,
  rpcClients: ReadonlyMap<string, BlockHeaderReader>,
  timestampCache: Map<string, string>,
): Promise<MessageTrace | null> {
  let changed = false;
  const repairedEvents: MessageEvent[] = [];

  for (const event of trace.events) {
    const repairedTimestamp = await resolveEventTimestamp(event, rpcClients, timestampCache);
    if (repairedTimestamp && repairedTimestamp !== event.timestamp) {
      repairedEvents.push({ ...event, timestamp: repairedTimestamp });
      changed = true;
      continue;
    }

    repairedEvents.push(event);
  }

  const timestamps = { ...trace.timestamps };
  const sendEvent = repairedEvents.find((event) => event.kind === "message_sent");
  if (sendEvent && needsRepair(timestamps.sendTime) && !needsRepair(sendEvent.timestamp)) {
    timestamps.sendTime = sendEvent.timestamp;
    changed = true;
  }

  const receiveEvent = repairedEvents.find(isReceiveTimestampEvent);
  if (receiveEvent && needsRepair(timestamps.receiveTime) && !needsRepair(receiveEvent.timestamp)) {
    timestamps.receiveTime = receiveEvent.timestamp;
    if (timestamps.blockRecv === undefined) {
      timestamps.blockRecv = receiveEvent.blockNumber;
    }
    changed = true;
  }

  if (!changed) return null;

  return {
    ...trace,
    events: repairedEvents,
    timestamps,
  };
}

async function resolveEventTimestamp(
  event: MessageEvent,
  rpcClients: ReadonlyMap<string, BlockHeaderReader>,
  timestampCache: Map<string, string>,
): Promise<string | undefined> {
  if (!needsRepair(event.timestamp)) {
    return event.timestamp;
  }
  if (!("blockNumber" in event) || !("chain" in event)) {
    return undefined;
  }

  const client = rpcClients.get(event.chain);
  if (!client) {
    return undefined;
  }

  const cacheKey = `${event.chain}:${event.blockNumber}`;
  const cachedTimestamp = timestampCache.get(cacheKey);
  if (cachedTimestamp) {
    return cachedTimestamp;
  }

  const header = await client.getBlockHeader(BigInt(event.blockNumber));
  const timestamp = new Date(Number(header.timestamp) * 1000).toISOString();
  timestampCache.set(cacheKey, timestamp);
  return timestamp;
}

function needsRepair(timestamp: string): boolean {
  return timestamp === "" || timestamp === PLACEHOLDER_TRACE_TIMESTAMP;
}

function isReceiveTimestampEvent(event: MessageEvent): event is ReceiveTimestampEvent {
  return (
    event.kind === "delivery_confirmed" ||
    event.kind === "execution_failed" ||
    event.kind === "retry_succeeded"
  );
}
