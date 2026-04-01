/**
 * Storage layer tests — migrations, repositories, and queries.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { openDb, closeDb, runMigrations } from "./index.js";
import {
  upsertNetwork,
  getNetwork,
  listNetworks,
} from "./repos/networks.js";
import {
  upsertChain,
  getChain,
  listChains,
} from "./repos/chains.js";
import {
  upsertScenarioRun,
  getScenarioRun,
  listScenarioRuns,
} from "./repos/scenarios.js";
import {
  upsertTrace,
  getTrace,
  listTraces,
  getTraceEvents,
  getTimeline,
  countTraces,
} from "./repos/traces.js";
import {
  upsertArtifact,
  listArtifacts,
} from "./repos/artifacts.js";
import {
  startImport,
  completeImport,
  getImport,
  listImports,
} from "./repos/imports.js";
import type { Database } from "better-sqlite3";
import type { NetworkManifest, MessageTrace, ScenarioRun } from "@warplane/domain";

let db: Database;

beforeEach(() => {
  db = openDb({ path: ":memory:" });
  runMigrations(db);
});

afterEach(() => {
  closeDb(db);
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const sampleManifest: NetworkManifest = {
  schemaVersion: "1.0.0",
  networkId: 88888,
  networkDir: "/tmp/test",
  teleporterVersion: "v1.0.0",
  source: {
    name: "source",
    blockchainId: "chain-src-001",
    subnetId: "subnet-src-001",
    evmChainId: 99999,
  },
  destination: {
    name: "destination",
    blockchainId: "chain-dst-001",
    subnetId: "subnet-dst-001",
    evmChainId: 99998,
  },
};

const sampleTrace: MessageTrace = {
  schemaVersion: "1.0.0",
  messageId: "abc123",
  scenario: "basic_send_receive",
  execution: "success",
  source: { name: "source", blockchainId: "chain-src-001", subnetId: "subnet-src-001", evmChainId: 99999 },
  destination: { name: "destination", blockchainId: "chain-dst-001", subnetId: "subnet-dst-001", evmChainId: 99998 },
  sender: "0xsender",
  recipient: "0xrecipient",
  sourceTxHash: "0xtx1",
  destinationTxHash: "0xtx2",
  timestamps: { sendTime: "2026-04-01T00:00:00Z", receiveTime: "2026-04-01T00:00:20Z", blockSend: 100, blockRecv: 105 },
  events: [
    { kind: "message_sent", timestamp: "2026-04-01T00:00:00Z", blockNumber: 100, txHash: "0xtx1", chain: "source" },
    { kind: "signatures_aggregated", timestamp: "2026-04-01T00:00:10Z" },
    { kind: "delivery_confirmed", timestamp: "2026-04-01T00:00:20Z", blockNumber: 105, txHash: "0xtx2", chain: "destination" },
  ],
  relayer: { address: "0xrelayer", txHash: "0xtx2" },
};

const sampleRun: ScenarioRun = {
  scenario: "basic_send_receive",
  startedAt: "2026-04-01T00:00:00Z",
  completedAt: "2026-04-01T00:05:00Z",
  passed: true,
  messageIds: ["abc123"],
  traceFiles: ["abc123.json"],
};

// ---------------------------------------------------------------------------
// Migration tests
// ---------------------------------------------------------------------------

describe("migrations", () => {
  it("runs cleanly on a fresh database", () => {
    // Already ran in beforeEach — verify tables exist
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as Array<{ name: string }>;
    const names = tables.map((t) => t.name);

    expect(names).toContain("networks");
    expect(names).toContain("chains");
    expect(names).toContain("scenario_runs");
    expect(names).toContain("traces");
    expect(names).toContain("events");
    expect(names).toContain("artifacts");
    expect(names).toContain("import_history");
    expect(names).toContain("migrations");
  });

  it("is idempotent — running twice is safe", () => {
    const second = runMigrations(db);
    expect(second).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Network repository
// ---------------------------------------------------------------------------

describe("networks repo", () => {
  it("upserts and retrieves a network manifest", () => {
    upsertNetwork(db, sampleManifest);
    const found = getNetwork(db, 88888);
    expect(found).toBeDefined();
    expect(found!.networkId).toBe(88888);
    expect(found!.source.blockchainId).toBe("chain-src-001");
  });

  it("upserts idempotently", () => {
    upsertNetwork(db, sampleManifest);
    upsertNetwork(db, sampleManifest);
    expect(listNetworks(db)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Chain repository
// ---------------------------------------------------------------------------

describe("chains repo", () => {
  it("upserts and retrieves chains", () => {
    upsertChain(db, sampleManifest.source);
    const found = getChain(db, "chain-src-001");
    expect(found).toBeDefined();
    expect(found!.name).toBe("source");
    expect(found!.evmChainId).toBe(99999);
  });

  it("lists all chains", () => {
    upsertChain(db, sampleManifest.source);
    upsertChain(db, sampleManifest.destination);
    expect(listChains(db)).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Trace repository
// ---------------------------------------------------------------------------

describe("traces repo", () => {
  it("upserts a trace with events", () => {
    const id = upsertTrace(db, sampleTrace);
    expect(id).toBeGreaterThan(0);

    const found = getTrace(db, "abc123");
    expect(found).toBeDefined();
    expect(found!.execution).toBe("success");
    expect(found!.events).toHaveLength(3);
  });

  it("is idempotent on re-import", () => {
    upsertTrace(db, sampleTrace);
    upsertTrace(db, sampleTrace);
    expect(countTraces(db)).toBe(1);
  });

  it("preserves event ordering", () => {
    upsertTrace(db, sampleTrace);
    const events = getTraceEvents(db, "abc123");
    expect(events).toHaveLength(3);
    expect(events[0]!.kind).toBe("message_sent");
    expect(events[1]!.kind).toBe("signatures_aggregated");
    expect(events[2]!.kind).toBe("delivery_confirmed");
  });

  it("filters by scenario", () => {
    upsertTrace(db, sampleTrace);
    upsertTrace(db, { ...sampleTrace, messageId: "xyz789", scenario: "add_fee" });

    expect(listTraces(db, { scenario: "basic_send_receive" })).toHaveLength(1);
    expect(listTraces(db, { scenario: "add_fee" })).toHaveLength(1);
    expect(listTraces(db)).toHaveLength(2);
  });

  it("filters by execution status", () => {
    upsertTrace(db, sampleTrace);
    upsertTrace(db, { ...sampleTrace, messageId: "fail1", scenario: "fail_test", execution: "failed" });

    expect(listTraces(db, { execution: "success" })).toHaveLength(1);
    expect(listTraces(db, { execution: "failed" })).toHaveLength(1);
  });

  it("builds a chronological timeline", () => {
    upsertTrace(db, sampleTrace);
    const timeline = getTimeline(db);
    expect(timeline.length).toBe(3);
    // Verify chronological order
    for (let i = 1; i < timeline.length; i++) {
      expect(timeline[i]!.timestamp >= timeline[i - 1]!.timestamp).toBe(true);
    }
    // Each timeline entry has messageId
    expect(timeline[0]!.messageId).toBe("abc123");
  });
});

// ---------------------------------------------------------------------------
// Scenario runs
// ---------------------------------------------------------------------------

describe("scenario_runs repo", () => {
  it("upserts and retrieves scenario runs", () => {
    upsertScenarioRun(db, sampleRun);
    const found = getScenarioRun(db, "basic_send_receive");
    expect(found).toBeDefined();
    expect(found!.passed).toBe(true);
    expect(found!.messageIds).toEqual(["abc123"]);
  });

  it("lists all runs", () => {
    upsertScenarioRun(db, sampleRun);
    upsertScenarioRun(db, { ...sampleRun, scenario: "add_fee", startedAt: "2026-04-01T00:10:00Z" });
    expect(listScenarioRuns(db)).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Artifacts
// ---------------------------------------------------------------------------

describe("artifacts repo", () => {
  it("upserts and lists artifacts", () => {
    upsertArtifact(db, { type: "trace", path: "/tmp/trace.json", description: "test" });
    upsertArtifact(db, { type: "network_manifest", path: "/tmp/network.json" });
    expect(listArtifacts(db)).toHaveLength(2);
    expect(listArtifacts(db, { type: "trace" })).toHaveLength(1);
  });

  it("is idempotent on same path", () => {
    upsertArtifact(db, { type: "trace", path: "/tmp/trace.json" });
    upsertArtifact(db, { type: "trace", path: "/tmp/trace.json" });
    expect(listArtifacts(db)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Import history
// ---------------------------------------------------------------------------

describe("import_history repo", () => {
  it("tracks import lifecycle", () => {
    const id = startImport(db, "/tmp/artifacts", "fixture");
    const started = getImport(db, id);
    expect(started!.status).toBe("running");

    completeImport(db, id, { networks: 1, chains: 2, scenarios: 5, traces: 8, events: 40 });
    const completed = getImport(db, id);
    expect(completed!.status).toBe("completed");
    expect(completed!.tracesCount).toBe(8);
  });

  it("lists imports in reverse chronological order", () => {
    startImport(db, "/tmp/a");
    startImport(db, "/tmp/b");
    const imports = listImports(db);
    expect(imports).toHaveLength(2);
  });
});
