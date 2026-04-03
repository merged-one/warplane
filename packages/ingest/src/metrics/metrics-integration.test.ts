import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { openDb, closeDb, runMigrations, type Database, getTrace } from "@warplane/storage";
import type { TeleporterEvent } from "../rpc/decoder.js";
import { createPipeline } from "../pipeline/coordinator.js";
import type { NormalizedEvent } from "../pipeline/types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MSG_ID =
  "0x0000000000000000000000000000000000000000000000000000000000000001" as `0x${string}`;
const DEST_CHAIN =
  "0x0000000000000000000000000000000000000000000000000000000000000002" as `0x${string}`;
const SRC_CHAIN =
  "0x0000000000000000000000000000000000000000000000000000000000000003" as `0x${string}`;

function makeSendEvent(blockNumber: bigint): TeleporterEvent {
  return {
    eventName: "SendCrossChainMessage",
    args: {
      messageID: MSG_ID,
      destinationBlockchainID: DEST_CHAIN,
      message: {
        messageNonce: 1n,
        originSenderAddress: "0xSender",
        destinationBlockchainID: DEST_CHAIN,
        destinationAddress: "0xRecipient",
        requiredGasLimit: 100000n,
        allowedRelayerAddresses: [],
        receipts: [],
        message: "0x",
      },
      feeInfo: { feeTokenAddress: "0xFee", amount: 500n },
    },
    blockNumber,
    transactionHash: `0xtx${blockNumber}`,
    logIndex: 0,
    blockHash: `0xblock${blockNumber}`,
    removed: false,
  };
}

function makeReceiveEvent(blockNumber: bigint): TeleporterEvent {
  return {
    eventName: "ReceiveCrossChainMessage",
    args: {
      messageID: MSG_ID,
      sourceBlockchainID: SRC_CHAIN,
      deliverer: "0xRelayer",
      rewardRedeemer: "0xRedeemer",
      message: {},
    },
    blockNumber,
    transactionHash: `0xtx${blockNumber}`,
    logIndex: 0,
    blockHash: `0xblock${blockNumber}`,
    removed: false,
  };
}

function offChainEvent(
  kind: NormalizedEvent["kind"],
  messageId: string,
  chain: string = "",
  details: Record<string, unknown> = {},
): NormalizedEvent {
  return {
    kind,
    messageId,
    timestamp: new Date().toISOString(),
    blockNumber: 0,
    txHash: "",
    chain,
    source: "off-chain",
    details,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let db: Database;

beforeEach(() => {
  db = openDb({ path: ":memory:" });
  runMigrations(db);
});

afterEach(() => {
  closeDb(db);
});

// ---------------------------------------------------------------------------
// Integration tests
// ---------------------------------------------------------------------------

describe("Pipeline Integration — Off-chain Events", () => {
  it("off-chain warp_message_extracted transitions pending trace to relaying", async () => {
    const pipeline = createPipeline(db);
    await pipeline.handleEvents("chain-a", [makeSendEvent(1n)]);

    pipeline.injectEvents([offChainEvent("warp_message_extracted", MSG_ID, "chain-a")]);
    pipeline.flush();

    const trace = getTrace(db, MSG_ID);
    expect(trace).toBeDefined();
    expect(trace!.execution).toBe("pending"); // relaying maps to "pending" execution
  });

  it("off-chain signatures_aggregated recorded on relaying trace", async () => {
    const pipeline = createPipeline(db);
    await pipeline.handleEvents("chain-a", [makeSendEvent(1n)]);

    pipeline.injectEvents([
      offChainEvent("warp_message_extracted", MSG_ID, "chain-a"),
      offChainEvent("signatures_aggregated", MSG_ID, "", {
        aggregationLatencyMs: 2000,
      }),
    ]);
    pipeline.flush();

    const trace = getTrace(db, MSG_ID);
    expect(trace).toBeDefined();
    expect(trace!.events.length).toBeGreaterThanOrEqual(3); // send + warp + sig_agg
  });

  it("off-chain relay_submitted recorded on relaying trace", async () => {
    const pipeline = createPipeline(db);
    await pipeline.handleEvents("chain-a", [makeSendEvent(1n)]);

    pipeline.injectEvents([
      offChainEvent("warp_message_extracted", MSG_ID, "chain-a"),
      offChainEvent("relay_submitted", MSG_ID, "chain-b"),
    ]);
    pipeline.flush();

    const trace = getTrace(db, MSG_ID);
    expect(trace).toBeDefined();
    expect(trace!.events.length).toBeGreaterThanOrEqual(3);
  });

  it("full flow: on-chain send → off-chain warp+sig+relay → on-chain deliver", async () => {
    const pipeline = createPipeline(db);

    // 1. On-chain send
    await pipeline.handleEvents("chain-a", [makeSendEvent(1n)]);

    // 2. Off-chain relay phase
    pipeline.injectEvents([
      offChainEvent("warp_message_extracted", MSG_ID, "chain-a"),
      offChainEvent("signatures_aggregated", MSG_ID, "", {
        aggregationLatencyMs: 1500,
      }),
      offChainEvent("relay_submitted", MSG_ID, "chain-b"),
    ]);

    // 3. On-chain delivery
    await pipeline.handleEvents("chain-b", [makeReceiveEvent(10n)]);
    pipeline.flush();

    const trace = getTrace(db, MSG_ID);
    expect(trace).toBeDefined();
    expect(trace!.execution).toBe("success");
    expect(trace!.events.length).toBe(5); // send + warp + sig + relay + deliver
  });

  it("off-chain events with no matching trace create partial trace", () => {
    const pipeline = createPipeline(db);
    const syntheticId = "metrics:chain-a:chain-b:2024-01-01T00:00:00Z:0:warp";

    pipeline.injectEvents([offChainEvent("warp_message_extracted", syntheticId, "chain-a")]);
    pipeline.flush();

    const stats = pipeline.stats();
    expect(stats.tracesCreated).toBe(1);
    expect(stats.eventsNormalized).toBe(1);
  });

  it("partial off-chain trace completed by later on-chain send", async () => {
    const pipeline = createPipeline(db);

    // Off-chain event arrives first (delivery_confirmed out of order)
    pipeline.injectEvents([
      offChainEvent("delivery_confirmed", MSG_ID, "chain-b", {
        sourceBlockchainID: SRC_CHAIN,
      }),
    ]);

    // On-chain send arrives later
    await pipeline.handleEvents("chain-a", [makeSendEvent(1n)]);
    pipeline.flush();

    const trace = getTrace(db, MSG_ID);
    expect(trace).toBeDefined();
    // delivery_confirmed creates in "delivered" state; message_sent enriches but
    // doesn't override state since there's no transition from delivered→pending
    expect(trace!.events.length).toBe(2);
  });

  it("pipeline works normally when no off-chain events arrive", async () => {
    const pipeline = createPipeline(db);
    await pipeline.handleEvents("chain-a", [makeSendEvent(1n)]);
    await pipeline.handleEvents("chain-b", [makeReceiveEvent(5n)]);
    pipeline.flush();

    const trace = getTrace(db, MSG_ID);
    expect(trace).toBeDefined();
    expect(trace!.execution).toBe("success");
    expect(trace!.events.length).toBe(2);
  });

  it("stats correctly count injected off-chain events", () => {
    const pipeline = createPipeline(db);

    pipeline.injectEvents([
      offChainEvent("warp_message_extracted", "msg-1", "chain-a"),
      offChainEvent("signatures_aggregated", "msg-2", ""),
      offChainEvent("relay_submitted", "msg-3", "chain-b"),
    ]);

    const stats = pipeline.stats();
    expect(stats.eventsReceived).toBe(3);
    expect(stats.eventsNormalized).toBe(3);
    expect(stats.eventsDropped).toBe(0);
    expect(stats.tracesCreated).toBe(3);
  });
});
