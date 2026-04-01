/**
 * `icp traces list` — list message traces.
 * `warplane traces show <messageId>` — show trace detail with timeline.
 */

import { Command } from "commander";
import { ApiClient } from "../api-client.js";
import {
  isJsonMode,
  printJson,
  heading,
  detail,
  table,
  hint,
  shortId,
  truncate,
} from "../output.js";

export function tracesCommand(): Command {
  const traces = new Command("traces").description("Inspect cross-chain message traces");

  traces
    .command("list")
    .description("List message traces")
    .option("-s, --scenario <name>", "Filter by scenario name")
    .option("--status <status>", "Filter by execution status")
    .option("--chain <id>", "Filter by source or destination chain")
    .option("-n, --limit <n>", "Max results", "20")
    .action(async (opts: { scenario?: string; status?: string; chain?: string; limit: string }) => {
      const client = new ApiClient();
      const data = await client.get<{
        traces: TraceRow[];
        total: number;
        page: number;
        pageSize: number;
      }>("/api/v1/traces", {
        scenario: opts.scenario,
        status: opts.status,
        chain: opts.chain,
        pageSize: opts.limit,
      });

      if (isJsonMode()) {
        printJson(data);
        return;
      }

      heading(`Traces (${data.total} total)`);
      table(
        ["MESSAGE ID", "SCENARIO", "STATUS", "SOURCE", "DEST", "SEND TIME"],
        data.traces.map((t) => [
          shortId(t.messageId),
          truncate(t.scenario, 28),
          statusLabel(t.execution),
          t.source?.name ?? "—",
          t.destination?.name ?? "—",
          formatTime(t.timestamps?.sendTime),
        ]),
      );

      if (data.traces.length > 0) {
        hint("Show detail: warplane traces show <messageId>");
      }
    });

  traces
    .command("show <messageId>")
    .description("Show detailed trace with timeline")
    .action(async (messageId: string) => {
      const client = new ApiClient();

      // If a partial ID is given, try to find a matching trace
      let resolvedId = messageId;
      if (messageId.length < 64) {
        const search = await client.get<{ traces: TraceRow[] }>("/api/v1/traces", {
          pageSize: 200,
        });
        const matches = search.traces.filter((t) =>
          t.messageId.toLowerCase().startsWith(messageId.toLowerCase()),
        );
        if (matches.length === 0) {
          const msg = `No trace found matching "${messageId}"`;
          if (isJsonMode()) {
            printJson({ error: msg });
          } else {
            console.error(msg);
          }
          process.exitCode = 1;
          return;
        }
        resolvedId = matches[0].messageId;
      }

      // Fetch trace + timeline in parallel
      const [trace, timeline] = await Promise.all([
        client.get<TraceRow>(`/api/v1/traces/${resolvedId}`),
        client.get<{ messageId: string; events: EventRow[] }>(
          `/api/v1/traces/${resolvedId}/timeline`,
        ),
      ]);

      if (isJsonMode()) {
        printJson({ ...trace, timeline: timeline.events });
        return;
      }

      heading(`Trace: ${trace.messageId}`);

      detail("Message ID", trace.messageId);
      detail("Scenario", trace.scenario);
      detail("Status", statusLabel(trace.execution));
      detail("Source", `${trace.source?.name ?? "—"} (${shortId(trace.source?.blockchainId ?? "")})`);
      detail("Destination", `${trace.destination?.name ?? "—"} (${shortId(trace.destination?.blockchainId ?? "")})`);
      detail("Sender", trace.sender);
      detail("Recipient", trace.recipient);
      detail("Send time", trace.timestamps?.sendTime ?? "—");
      detail("Receive time", trace.timestamps?.receiveTime ?? "—");
      detail("Source tx", trace.sourceTxHash ?? "—");
      detail("Destination tx", trace.destinationTxHash ?? "—");

      // Relayer info
      if (trace.relayer) {
        detail("Relayer", trace.relayer.address);
        detail("Relay tx", trace.relayer.txHash);
      }

      // Fee info
      if (trace.fee) {
        detail("Fee token", trace.fee.feeTokenAddress);
        detail("Fee total", trace.fee.totalAmount);
      }

      // Retry info
      if (trace.retry) {
        detail("Retry gas", `${trace.retry.originalGasLimit} → ${trace.retry.retryGasLimit}`);
        detail("Retry tx", trace.retry.retryTxHash);
      }
      if (trace.retryCount !== undefined && trace.retryCount > 0) {
        detail("Retry count", trace.retryCount);
      }

      // Timeline
      if (timeline.events.length > 0) {
        heading("Timeline");
        table(
          ["TIME", "EVENT", "CHAIN", "TX HASH", "DETAILS"],
          timeline.events.map((e) => [
            formatTime(e.timestamp),
            e.kind,
            "chain" in e ? String(e.chain ?? "") : "",
            "txHash" in e ? shortId(String(e.txHash ?? "")) : "",
            e.details ?? "",
          ]),
        );
      }
    });

  return traces;
}

// -- Helpers -----------------------------------------------------------------

function statusLabel(s: string): string {
  const colors: Record<string, string> = {
    success: "\x1b[32msuccess\x1b[0m",
    retry_success: "\x1b[32mretry_success\x1b[0m",
    pending: "\x1b[33mpending\x1b[0m",
    failed: "\x1b[31mfailed\x1b[0m",
    replay_blocked: "\x1b[31mreplay_blocked\x1b[0m",
  };
  if (!process.stdout.isTTY) return s;
  return colors[s] ?? s;
}

function formatTime(iso: string | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "Z");
  } catch {
    return iso;
  }
}

// Minimal type shapes matching the API response
interface TraceRow {
  messageId: string;
  scenario: string;
  execution: string;
  source: { name: string; blockchainId: string } | null;
  destination: { name: string; blockchainId: string } | null;
  sender: string;
  recipient: string;
  sourceTxHash?: string;
  destinationTxHash?: string;
  timestamps: { sendTime?: string; receiveTime?: string };
  relayer?: { address: string; txHash: string };
  fee?: { feeTokenAddress: string; totalAmount: string };
  retry?: { originalGasLimit: number; retryGasLimit: number; retryTxHash: string };
  retryCount?: number;
  events: unknown[];
}

interface EventRow {
  kind: string;
  timestamp: string;
  details?: string;
  chain?: string;
  txHash?: string;
}
