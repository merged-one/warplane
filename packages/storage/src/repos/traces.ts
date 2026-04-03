/**
 * Repository functions for message traces and their events.
 */

import type { Database } from "better-sqlite3";
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
 * Upsert a trace and all its events in a single transaction.
 * Returns the trace DB id.
 */
export function upsertTrace(db: Database, trace: MessageTrace, importId?: number): number {
  const traceId = upsertTraceRow(db, trace, importId);
  replaceEvents(db, traceId, trace.messageId, trace.events);
  return traceId;
}

function upsertTraceRow(db: Database, trace: MessageTrace, importId?: number): number {
  const stmt = db.prepare(`
    INSERT INTO traces (
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
      updated_at = datetime('now')
    RETURNING id
  `);

  const row = stmt.get(
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
  ) as { id: number };

  return row.id;
}

function replaceEvents(
  db: Database,
  traceId: number,
  messageId: string,
  events: MessageEvent[],
): void {
  db.prepare("DELETE FROM events WHERE trace_id = ?").run(traceId);

  const stmt = db.prepare(`
    INSERT INTO events (trace_id, message_id, kind, timestamp, block_number, tx_hash, chain, details, seq, event_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (let i = 0; i < events.length; i++) {
    const e = events[i]!;
    stmt.run(
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
    );
  }
}

/**
 * Get a single trace by message ID and scenario.
 */
export function getTrace(
  db: Database,
  messageId: string,
  scenario?: string,
): MessageTrace | undefined {
  const sql = scenario
    ? "SELECT trace_json FROM traces WHERE message_id = ? AND scenario = ?"
    : "SELECT trace_json FROM traces WHERE message_id = ? ORDER BY created_at DESC LIMIT 1";
  const params = scenario ? [messageId, scenario] : [messageId];
  const row = db.prepare(sql).get(...params) as { trace_json: string } | undefined;
  return row ? (JSON.parse(row.trace_json) as MessageTrace) : undefined;
}

/**
 * List traces with optional filtering.
 */
export function listTraces(db: Database, filter?: TraceFilter): MessageTrace[] {
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

  const rows = db
    .prepare(`SELECT trace_json FROM traces ${where} ORDER BY send_time ASC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset) as Array<{ trace_json: string }>;

  return rows.map((r) => JSON.parse(r.trace_json) as MessageTrace);
}

/**
 * Get events for a trace, ordered by sequence.
 */
export function getTraceEvents(db: Database, messageId: string): MessageEvent[] {
  const rows = db
    .prepare(
      `SELECT e.event_json FROM events e
       JOIN traces t ON e.trace_id = t.id
       WHERE t.message_id = ?
       ORDER BY e.seq ASC`,
    )
    .all(messageId) as Array<{ event_json: string }>;
  return rows.map((r) => JSON.parse(r.event_json) as MessageEvent);
}

/**
 * Get a timeline of events across all traces, sorted chronologically.
 */
export function getTimeline(
  db: Database,
  opts?: { scenario?: string; limit?: number },
): Array<MessageEvent & { messageId: string }> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (opts?.scenario) {
    conditions.push("t.scenario = ?");
    params.push(opts.scenario);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = opts?.limit ?? 200;

  const rows = db
    .prepare(
      `SELECT e.event_json, e.message_id
       FROM events e
       JOIN traces t ON e.trace_id = t.id
       ${where}
       ORDER BY e.timestamp ASC, e.seq ASC
       LIMIT ?`,
    )
    .all(...params, limit) as Array<{ event_json: string; message_id: string }>;

  return rows.map((r) => ({
    ...(JSON.parse(r.event_json) as MessageEvent),
    messageId: r.message_id,
  }));
}

/**
 * Count traces matching a filter.
 */
export function countTraces(
  db: Database,
  filter?: Pick<TraceFilter, "scenario" | "execution">,
): number {
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
  const row = db.prepare(`SELECT COUNT(*) as count FROM traces ${where}`).get(...params) as {
    count: number;
  };
  return row.count;
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
export function getFailureClassification(
  db: Database,
  opts?: { since?: string },
): FailureClassificationEntry[] {
  const conditions = ["e.kind = 'execution_failed'"];
  const params: unknown[] = [];

  if (opts?.since) {
    conditions.push("e.timestamp >= ?");
    params.push(opts.since);
  }

  const where = conditions.join(" AND ");
  const rows = db
    .prepare(
      `SELECT COALESCE(e.details, 'unknown') as reason, COUNT(*) as count
       FROM events e
       WHERE ${where}
       GROUP BY reason
       ORDER BY count DESC`,
    )
    .all(...params) as Array<{ reason: string; count: number }>;

  return rows;
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
 */
export function getDeliveryLatencyStats(db: Database, opts?: { since?: string }): LatencyStats {
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

  // Get all latencies in ms
  const rows = db
    .prepare(
      `SELECT send_time, receive_time,
              CAST((julianday(receive_time) - julianday(send_time)) * 86400000 AS INTEGER) as latency_ms
       FROM traces
       WHERE ${where}
       ORDER BY send_time ASC`,
    )
    .all(...params) as Array<{ send_time: string; receive_time: string; latency_ms: number }>;

  if (rows.length === 0) {
    return { p50: 0, p90: 0, p99: 0, timeSeries: [] };
  }

  // Compute percentiles
  const latencies = rows.map((r) => r.latency_ms).sort((a, b) => a - b);
  const percentile = (sorted: number[], p: number): number => {
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)]!;
  };

  // Hourly time-series (average latency per hour)
  const hourlyBuckets = new Map<string, { sum: number; count: number }>();
  for (const row of rows) {
    const hour = row.send_time.slice(0, 13); // "YYYY-MM-DDTHH"
    const bucket = hourlyBuckets.get(hour);
    if (bucket) {
      bucket.sum += row.latency_ms;
      bucket.count += 1;
    } else {
      hourlyBuckets.set(hour, { sum: row.latency_ms, count: 1 });
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
