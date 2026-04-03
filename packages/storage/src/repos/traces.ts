/**
 * Repository functions for message traces and their events.
 *
 * Async, Postgres-native. Uses DatabaseAdapter interface.
 */

import type { DatabaseAdapter } from "../adapter.js";
import type { MessageTrace, MessageEvent } from "@warplane/domain";

export interface TraceFilter {
  scenario?: string;
  execution?: string;
  sourceChain?: string;
  destChain?: string;
  limit?: number;
  offset?: number;
}

/**
 * Upsert a trace and all its events.
 * Returns the trace DB id.
 */
export async function upsertTrace(
  db: DatabaseAdapter,
  trace: MessageTrace,
  importId?: number,
): Promise<number> {
  const traceId = await upsertTraceRow(db, trace, importId);
  await replaceEvents(db, traceId, trace.messageId, trace.events);
  return traceId;
}

async function upsertTraceRow(
  db: DatabaseAdapter,
  trace: MessageTrace,
  importId?: number,
): Promise<number> {
  const result = await db.query<{ id: number }>(
    `INSERT INTO traces (
      message_id, scenario, execution, schema_version,
      source_name, source_blockchain_id, source_subnet_id, source_evm_chain_id,
      dest_name, dest_blockchain_id, dest_subnet_id, dest_evm_chain_id,
      sender, recipient,
      source_tx_hash, destination_tx_hash, relay_tx_hash,
      send_time, receive_time, block_send, block_recv,
      relayer_json, fee_json, retry_json, raw_refs_json,
      trace_json, import_id
    ) VALUES (
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?
    )
    ON CONFLICT(message_id, scenario) DO UPDATE SET
      execution = excluded.execution,
      schema_version = excluded.schema_version,
      source_name = excluded.source_name,
      source_blockchain_id = excluded.source_blockchain_id,
      source_subnet_id = excluded.source_subnet_id,
      source_evm_chain_id = excluded.source_evm_chain_id,
      dest_name = excluded.dest_name,
      dest_blockchain_id = excluded.dest_blockchain_id,
      dest_subnet_id = excluded.dest_subnet_id,
      dest_evm_chain_id = excluded.dest_evm_chain_id,
      sender = excluded.sender,
      recipient = excluded.recipient,
      source_tx_hash = excluded.source_tx_hash,
      destination_tx_hash = excluded.destination_tx_hash,
      relay_tx_hash = excluded.relay_tx_hash,
      send_time = excluded.send_time,
      receive_time = excluded.receive_time,
      block_send = excluded.block_send,
      block_recv = excluded.block_recv,
      relayer_json = excluded.relayer_json,
      fee_json = excluded.fee_json,
      retry_json = excluded.retry_json,
      raw_refs_json = excluded.raw_refs_json,
      trace_json = excluded.trace_json,
      import_id = excluded.import_id,
      updated_at = CURRENT_TIMESTAMP
    RETURNING id`,
    [
      trace.messageId,
      trace.scenario,
      trace.execution,
      trace.schemaVersion ?? "1.0.0",
      trace.source.name,
      trace.source.blockchainId,
      trace.source.subnetId,
      trace.source.evmChainId,
      trace.destination.name,
      trace.destination.blockchainId,
      trace.destination.subnetId,
      trace.destination.evmChainId,
      trace.sender,
      trace.recipient,
      trace.sourceTxHash,
      trace.destinationTxHash ?? null,
      trace.relayTxHash ?? null,
      trace.timestamps.sendTime,
      trace.timestamps.receiveTime,
      trace.timestamps.blockSend,
      trace.timestamps.blockRecv ?? null,
      trace.relayer ? JSON.stringify(trace.relayer) : null,
      trace.fee ? JSON.stringify(trace.fee) : null,
      trace.retry ? JSON.stringify(trace.retry) : null,
      trace.rawRefs ? JSON.stringify(trace.rawRefs) : null,
      JSON.stringify(trace),
      importId ?? null,
    ],
  );

  return result.rows[0]!.id;
}

async function replaceEvents(
  db: DatabaseAdapter,
  traceId: number,
  messageId: string,
  events: MessageEvent[],
): Promise<void> {
  await db.execute("DELETE FROM events WHERE trace_id = ?", [traceId]);

  for (let i = 0; i < events.length; i++) {
    const e = events[i]!;
    await db.execute(
      `INSERT INTO events (trace_id, message_id, kind, timestamp, block_number, tx_hash, chain, details, seq, event_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        traceId,
        messageId,
        e.kind,
        e.timestamp,
        "blockNumber" in e ? (e.blockNumber as number) : null,
        "txHash" in e ? (e.txHash as string) : null,
        "chain" in e ? (e.chain as string) : null,
        e.details ?? null,
        i,
        JSON.stringify(e),
      ],
    );
  }
}

/**
 * Get a single trace by message ID and optional scenario.
 */
export async function getTrace(
  db: DatabaseAdapter,
  messageId: string,
  scenario?: string,
): Promise<MessageTrace | undefined> {
  const sql = scenario
    ? "SELECT trace_json FROM traces WHERE message_id = ? AND scenario = ?"
    : "SELECT trace_json FROM traces WHERE message_id = ? ORDER BY created_at DESC LIMIT 1";
  const params = scenario ? [messageId, scenario] : [messageId];
  const result = await db.query<{ trace_json: string }>(sql, params);
  return result.rows[0] ? (JSON.parse(result.rows[0].trace_json) as MessageTrace) : undefined;
}

/**
 * List traces with optional filtering.
 */
export async function listTraces(
  db: DatabaseAdapter,
  filter?: TraceFilter,
): Promise<MessageTrace[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filter?.scenario) {
    conditions.push("scenario = ?");
    params.push(filter.scenario);
  }
  if (filter?.execution) {
    conditions.push("execution = ?");
    params.push(filter.execution);
  }
  if (filter?.sourceChain) {
    conditions.push("source_blockchain_id = ?");
    params.push(filter.sourceChain);
  }
  if (filter?.destChain) {
    conditions.push("dest_blockchain_id = ?");
    params.push(filter.destChain);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = filter?.limit ?? 100;
  const offset = filter?.offset ?? 0;

  const result = await db.query<{ trace_json: string }>(
    `SELECT trace_json FROM traces ${where} ORDER BY send_time ASC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return result.rows.map((r) => JSON.parse(r.trace_json) as MessageTrace);
}

/**
 * Get events for a trace, ordered by sequence.
 */
export async function getTraceEvents(
  db: DatabaseAdapter,
  messageId: string,
): Promise<MessageEvent[]> {
  const result = await db.query<{ event_json: string }>(
    `SELECT e.event_json FROM events e
     JOIN traces t ON e.trace_id = t.id
     WHERE t.message_id = ?
     ORDER BY e.seq ASC`,
    [messageId],
  );
  return result.rows.map((r) => JSON.parse(r.event_json) as MessageEvent);
}

/**
 * Get a timeline of events across all traces, sorted chronologically.
 */
export async function getTimeline(
  db: DatabaseAdapter,
  opts?: { scenario?: string; limit?: number },
): Promise<Array<MessageEvent & { messageId: string }>> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (opts?.scenario) {
    conditions.push("t.scenario = ?");
    params.push(opts.scenario);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = opts?.limit ?? 200;

  const result = await db.query<{ event_json: string; message_id: string }>(
    `SELECT e.event_json, e.message_id
     FROM events e
     JOIN traces t ON e.trace_id = t.id
     ${where}
     ORDER BY e.timestamp ASC, e.seq ASC
     LIMIT ?`,
    [...params, limit],
  );

  return result.rows.map((r) => ({
    ...(JSON.parse(r.event_json) as MessageEvent),
    messageId: r.message_id,
  }));
}

/**
 * Count traces matching a filter.
 */
export async function countTraces(
  db: DatabaseAdapter,
  filter?: Pick<TraceFilter, "scenario" | "execution">,
): Promise<number> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filter?.scenario) {
    conditions.push("scenario = ?");
    params.push(filter.scenario);
  }
  if (filter?.execution) {
    conditions.push("execution = ?");
    params.push(filter.execution);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM traces ${where}`,
    params,
  );
  return Number(result.rows[0]?.count ?? 0);
}

// ---------------------------------------------------------------------------
// Aggregate queries for dashboard
// ---------------------------------------------------------------------------

export interface FailureClassificationEntry {
  reason: string;
  count: number;
}

/**
 * Group execution_failed events by their details field.
 * Returns failure reasons sorted by count descending.
 */
export async function getFailureClassification(
  db: DatabaseAdapter,
  opts?: { since?: string },
): Promise<FailureClassificationEntry[]> {
  const conditions = ["e.kind = 'execution_failed'"];
  const params: unknown[] = [];

  if (opts?.since) {
    conditions.push("e.timestamp >= ?");
    params.push(opts.since);
  }

  const where = conditions.join(" AND ");
  const result = await db.query<{ reason: string; count: number }>(
    `SELECT COALESCE(e.details, 'unknown') as reason, COUNT(*) as count
     FROM events e
     WHERE ${where}
     GROUP BY reason
     ORDER BY count DESC`,
    params,
  );

  return result.rows.map((r) => ({ ...r, count: Number(r.count) }));
}

export interface LatencyStats {
  p50: number;
  p90: number;
  p99: number;
  timeSeries: Array<{ time: string; latencyMs: number }>;
}

/**
 * Compute delivery latency percentiles from completed traces.
 * Returns p50/p90/p99 in milliseconds and hourly time-series data.
 *
 * Computes latency in application code (not SQL) for cross-DB compatibility.
 */
export async function getDeliveryLatencyStats(
  db: DatabaseAdapter,
  opts?: { since?: string },
): Promise<LatencyStats> {
  const conditions = [
    "execution = 'success'",
    "send_time IS NOT NULL",
    "receive_time IS NOT NULL",
    "receive_time != send_time",
  ];
  const params: unknown[] = [];

  if (opts?.since) {
    conditions.push("send_time >= ?");
    params.push(opts.since);
  }

  const where = conditions.join(" AND ");

  const result = await db.query<{ send_time: string; receive_time: string }>(
    `SELECT send_time, receive_time
     FROM traces
     WHERE ${where}
     ORDER BY send_time ASC`,
    params,
  );

  if (result.rows.length === 0) {
    return { p50: 0, p90: 0, p99: 0, timeSeries: [] };
  }

  // Compute latencies in application code
  const rows = result.rows.map((r) => ({
    sendTime: r.send_time,
    latencyMs: Math.max(0, Date.parse(r.receive_time) - Date.parse(r.send_time)),
  }));

  const latencies = rows.map((r) => r.latencyMs).sort((a, b) => a - b);
  const percentile = (sorted: number[], p: number): number => {
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)]!;
  };

  // Hourly time-series (average latency per hour)
  const hourlyBuckets = new Map<string, { sum: number; count: number }>();
  for (const row of rows) {
    const hour = row.sendTime.slice(0, 13); // "YYYY-MM-DDTHH"
    const bucket = hourlyBuckets.get(hour);
    if (bucket) {
      bucket.sum += row.latencyMs;
      bucket.count += 1;
    } else {
      hourlyBuckets.set(hour, { sum: row.latencyMs, count: 1 });
    }
  }

  const timeSeries = Array.from(hourlyBuckets.entries()).map(([time, { sum, count }]) => ({
    time,
    latencyMs: Math.round(sum / count),
  }));

  return {
    p50: percentile(latencies, 50),
    p90: percentile(latencies, 90),
    p99: percentile(latencies, 99),
    timeSeries,
  };
}
