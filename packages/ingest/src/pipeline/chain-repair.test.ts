import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestAdapter, initTestSchema } from "@warplane/storage/test-utils";
import { getTrace, upsertTrace, type DatabaseAdapter } from "@warplane/storage";
import type { ChainMeta, MessageTrace } from "@warplane/domain";
import { repairCanonicalTraceChains } from "./chain-repair.js";

const CXCHAIN_ID = "25xjR3fvh7aXkxs36n1xRc3wLUAuqnS1wBxJD1BC4z3y6mHsEV";
const CXCHAIN_RAW = "0x8ef5dc1c38fc403fe671cdc1f2304d4a74b6bc5350d18a0fdb9d644d777e8b9c";
const MAINNET_CCHAIN_ID = "2q9e4r6Mu3U68nU1fYjgbR6JvwrRx36CohpAX5UQxse55x1Q5";
const MAINNET_CCHAIN_RAW = "0x0427d4b22a2a78bcddd456742caf91b56badbff985ee19aef14573e7343fd652";

let db: DatabaseAdapter;

beforeEach(async () => {
  db = createTestAdapter();
  await initTestSchema(db);
});

afterEach(async () => {
  await db.close();
});

function makeChain(name: string, blockchainId: string, evmChainId: number): ChainMeta {
  return {
    name,
    blockchainId,
    subnetId: "",
    evmChainId,
  };
}

function makeTrace(messageId: string): MessageTrace {
  return {
    schemaVersion: "1.0.0",
    messageId,
    scenario: "on-chain",
    execution: "success",
    source: {
      name: "unknown",
      blockchainId: "",
      subnetId: "",
      evmChainId: 0,
    },
    destination: {
      name: MAINNET_CCHAIN_RAW,
      blockchainId: MAINNET_CCHAIN_RAW,
      subnetId: "",
      evmChainId: 0,
    },
    sender: "",
    recipient: "",
    sourceTxHash: "",
    destinationTxHash: "0xdestination",
    timestamps: {
      sendTime: "1970-01-01T00:00:00.000Z",
      receiveTime: "2026-04-04T00:00:00.000Z",
      blockSend: 0,
      blockRecv: 82039026,
    },
    events: [
      {
        kind: "delivery_confirmed",
        timestamp: "2026-04-04T00:00:00.000Z",
        blockNumber: 82039026,
        txHash: "0xdestination",
        chain: MAINNET_CCHAIN_ID,
        details: JSON.stringify({
          sourceBlockchainID: CXCHAIN_RAW,
          destinationBlockchainID: MAINNET_CCHAIN_RAW,
        }),
      },
    ],
  };
}

describe("repairCanonicalTraceChains", () => {
  it("canonicalizes stored raw and missing chain IDs from the configured registry", async () => {
    await upsertTrace(db, makeTrace("msg-1"));

    const chainRegistry = new Map<string, ChainMeta>([
      [CXCHAIN_ID, makeChain("CXChain", CXCHAIN_ID, 737373)],
      [MAINNET_CCHAIN_ID, makeChain("Mainnet C-Chain", MAINNET_CCHAIN_ID, 43114)],
    ]);

    const result = await repairCanonicalTraceChains(db, chainRegistry);

    expect(result).toEqual({ scanned: 1, repaired: 1 });

    const trace = await getTrace(db, "msg-1");
    expect(trace).toBeDefined();
    expect(trace!.source).toEqual({
      name: "CXChain",
      blockchainId: CXCHAIN_ID,
      subnetId: "",
      evmChainId: 737373,
    });
    expect(trace!.destination).toEqual({
      name: "Mainnet C-Chain",
      blockchainId: MAINNET_CCHAIN_ID,
      subnetId: "",
      evmChainId: 43114,
    });
  });

  it("leaves traces unchanged when the registry cannot resolve the chain IDs", async () => {
    await upsertTrace(db, makeTrace("msg-2"));

    const result = await repairCanonicalTraceChains(db, new Map());

    expect(result).toEqual({ scanned: 1, repaired: 0 });

    const trace = await getTrace(db, "msg-2");
    expect(trace).toBeDefined();
    expect(trace!.source.blockchainId).toBe("");
    expect(trace!.destination.blockchainId).toBe(MAINNET_CCHAIN_RAW);
  });
});
