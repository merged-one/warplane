/**
 * Ingest layer tests — import golden fixtures, verify idempotency,
 * timeline ordering, and scenario/status filters.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import { createTestAdapter, initTestSchema } from "@warplane/storage/test-utils";
import type { DatabaseAdapter } from "@warplane/storage";
import {
  listTraces,
  listNetworks,
  listChains,
  listScenarioRuns,
  getTimeline,
  countTraces,
  listImports,
  getTraceEvents,
} from "@warplane/storage";
import { importArtifacts } from "./importer.js";

const ARTIFACTS_DIR = path.resolve(import.meta.dirname, "../../../harness/tmpnet/artifacts");

let db: DatabaseAdapter;

beforeEach(async () => {
  db = createTestAdapter();
  await initTestSchema(db);
});

afterEach(async () => {
  await db.close();
});

describe("golden fixture import", () => {
  it("imports all committed golden traces", async () => {
    const result = await importArtifacts(db, {
      artifactsDir: ARTIFACTS_DIR,
      log: () => {}, // silent
    });

    expect(result.errors).toHaveLength(0);
    expect(result.networks).toBe(1);
    expect(result.chains).toBeGreaterThanOrEqual(2);
    expect(result.scenarios).toBeGreaterThanOrEqual(5);
    expect(result.traces).toBeGreaterThanOrEqual(8);
    expect(result.events).toBeGreaterThan(0);
  });

  it("produces correct network data", async () => {
    await importArtifacts(db, { artifactsDir: ARTIFACTS_DIR, log: () => {} });

    const networks = await listNetworks(db);
    expect(networks).toHaveLength(1);
    expect(networks[0]!.networkId).toBe(88888);
  });

  it("produces correct chain data", async () => {
    await importArtifacts(db, { artifactsDir: ARTIFACTS_DIR, log: () => {} });

    const chains = await listChains(db);
    expect(chains.length).toBeGreaterThanOrEqual(2);

    const src = chains.find((c) => c.blockchainId === "chain-src-001");
    expect(src).toBeDefined();
    expect(src!.name).toBe("source");
  });

  it("imports all scenario runs", async () => {
    await importArtifacts(db, { artifactsDir: ARTIFACTS_DIR, log: () => {} });

    const runs = await listScenarioRuns(db);
    expect(runs.length).toBeGreaterThanOrEqual(5);

    const basic = runs.find((r) => r.scenario === "basic_send_receive");
    expect(basic).toBeDefined();
    expect(basic!.passed).toBe(true);
  });
});

describe("idempotent re-import", () => {
  it("re-importing the same artifacts does not duplicate data", async () => {
    const first = await importArtifacts(db, { artifactsDir: ARTIFACTS_DIR, log: () => {} });
    const countAfterFirst = await countTraces(db);

    const second = await importArtifacts(db, { artifactsDir: ARTIFACTS_DIR, log: () => {} });
    const countAfterSecond = await countTraces(db);

    expect(countAfterFirst).toBe(countAfterSecond);
    expect(first.traces).toBe(second.traces);

    // Import history records both runs
    const imports = await listImports(db);
    expect(imports).toHaveLength(2);
  });
});

describe("timeline ordering", () => {
  it("returns events in chronological order across traces", async () => {
    await importArtifacts(db, { artifactsDir: ARTIFACTS_DIR, log: () => {} });

    const timeline = await getTimeline(db, { limit: 500 });
    expect(timeline.length).toBeGreaterThan(0);

    // Every consecutive pair should be chronologically ordered
    for (let i = 1; i < timeline.length; i++) {
      const prev = timeline[i - 1]!.timestamp;
      const curr = timeline[i]!.timestamp;
      expect(curr >= prev).toBe(true);
    }
  });

  it("preserves per-trace event ordering", async () => {
    await importArtifacts(db, { artifactsDir: ARTIFACTS_DIR, log: () => {} });

    // Check the basic_send_receive trace specifically
    const traces = await listTraces(db, { scenario: "basic_send_receive" });
    expect(traces.length).toBeGreaterThan(0);

    const events = await getTraceEvents(db, traces[0]!.messageId);
    expect(events[0]!.kind).toBe("message_sent");
    expect(events[events.length - 1]!.kind).toBe("delivery_confirmed");
  });
});

describe("filters by scenario and status", () => {
  it("filters traces by scenario", async () => {
    await importArtifacts(db, { artifactsDir: ARTIFACTS_DIR, log: () => {} });

    const basic = await listTraces(db, { scenario: "basic_send_receive" });
    expect(basic.length).toBeGreaterThan(0);
    for (const t of basic) {
      expect(t.scenario).toBe("basic_send_receive");
    }

    const addFee = await listTraces(db, { scenario: "add_fee" });
    expect(addFee.length).toBeGreaterThan(0);
    for (const t of addFee) {
      expect(t.scenario).toBe("add_fee");
    }
  });

  it("filters traces by execution status", async () => {
    await importArtifacts(db, { artifactsDir: ARTIFACTS_DIR, log: () => {} });

    const successes = await listTraces(db, { execution: "success" });
    expect(successes.length).toBeGreaterThan(0);
    for (const t of successes) {
      expect(t.execution).toBe("success");
    }

    const retries = await listTraces(db, { execution: "retry_success" });
    expect(retries.length).toBeGreaterThan(0);
    for (const t of retries) {
      expect(t.execution).toBe("retry_success");
    }
  });

  it("filters timeline by scenario", async () => {
    await importArtifacts(db, { artifactsDir: ARTIFACTS_DIR, log: () => {} });

    const timeline = await getTimeline(db, { scenario: "basic_send_receive" });
    expect(timeline.length).toBeGreaterThan(0);
  });
});
