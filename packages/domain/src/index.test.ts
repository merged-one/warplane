import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  chainId,
  MessageTrace,
  TraceIndex,
  MessageEvent,
  NetworkManifest,
  ScenarioRun,
  ExecutionStatus,
  MessageEventKind,
  ChainRegistryEntry,
  AppRegistryEntry,
  ArtifactReference,
  generateJsonSchemas,
  generateOpenAPIComponents,
} from "./index.js";

// ---------------------------------------------------------------------------
// Fixture paths
// ---------------------------------------------------------------------------

const ARTIFACTS_DIR = join(
  import.meta.dirname,
  "../../../harness/tmpnet/artifacts",
);
const TRACES_DIR = join(ARTIFACTS_DIR, "traces");
const SCENARIOS_DIR = join(ARTIFACTS_DIR, "scenarios");
const NETWORK_FILE = join(ARTIFACTS_DIR, "network/network.json");

// ---------------------------------------------------------------------------
// Legacy: chainId factory
// ---------------------------------------------------------------------------

describe("chainId", () => {
  it("creates a ChainId from a valid string", () => {
    const id = chainId(
      "2q9e4r6Mu3U68nU1fYjgbR6JvwrRx36CohpAX5UQxse55x1Q5",
    );
    expect(id.blockchainId).toBe(
      "2q9e4r6Mu3U68nU1fYjgbR6JvwrRx36CohpAX5UQxse55x1Q5",
    );
  });

  it("throws on empty string", () => {
    expect(() => chainId("")).toThrow("blockchainId must be non-empty");
  });
});

// ---------------------------------------------------------------------------
// Event schemas
// ---------------------------------------------------------------------------

describe("MessageEvent schema", () => {
  it("validates a message_sent event", () => {
    const evt = MessageEvent.parse({
      kind: "message_sent",
      timestamp: "2026-04-01T00:00:00Z",
      blockNumber: 100,
      txHash: "0xabc",
      chain: "source",
      details: "seq=0",
    });
    expect(evt.kind).toBe("message_sent");
  });

  it("validates a signatures_aggregated event (no chain/block)", () => {
    const evt = MessageEvent.parse({
      kind: "signatures_aggregated",
      timestamp: "2026-04-01T00:00:10Z",
      details: "quorum",
    });
    expect(evt.kind).toBe("signatures_aggregated");
  });

  it("validates all event kinds", () => {
    const kinds = MessageEventKind.options;
    expect(kinds).toContain("message_sent");
    expect(kinds).toContain("replay_blocked");
    expect(kinds).toContain("fee_added");
    expect(kinds).toContain("retry_succeeded");
    expect(kinds).toContain("receipts_sent");
    expect(kinds.length).toBe(11);
  });

  it("rejects unknown event kind", () => {
    expect(() =>
      MessageEvent.parse({
        kind: "unknown_event",
        timestamp: "2026-04-01T00:00:00Z",
      }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// ExecutionStatus
// ---------------------------------------------------------------------------

describe("ExecutionStatus", () => {
  it.each(["success", "retry_success", "replay_blocked", "failed", "pending"])(
    "accepts %s",
    (status) => {
      expect(ExecutionStatus.parse(status)).toBe(status);
    },
  );

  it("rejects unknown status", () => {
    expect(() => ExecutionStatus.parse("wat")).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Registry schemas
// ---------------------------------------------------------------------------

describe("ChainRegistryEntry", () => {
  it("validates a minimal chain entry", () => {
    const entry = ChainRegistryEntry.parse({
      name: "source",
      blockchainId: "chain-src-001",
      subnetId: "subnet-src-001",
      evmChainId: 99999,
    });
    expect(entry.name).toBe("source");
  });
});

describe("AppRegistryEntry", () => {
  it("validates an app with deployments", () => {
    const entry = AppRegistryEntry.parse({
      name: "Teleporter",
      version: "1.0.0",
      chains: [
        {
          blockchainId: "chain-src-001",
          contractAddress: "0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf",
        },
      ],
    });
    expect(entry.chains).toHaveLength(1);
  });
});

describe("ArtifactReference", () => {
  it("validates an artifact ref", () => {
    const ref = ArtifactReference.parse({
      type: "trace",
      path: "traces/abc.json",
      description: "golden trace",
    });
    expect(ref.type).toBe("trace");
  });
});

// ---------------------------------------------------------------------------
// Golden fixture validation: traces
// ---------------------------------------------------------------------------

describe("golden trace fixtures", () => {
  const indexJson = JSON.parse(readFileSync(join(TRACES_DIR, "index.json"), "utf-8"));

  it("validates the trace index", () => {
    const index = TraceIndex.parse(indexJson);
    expect(index.traces.length).toBeGreaterThan(0);
  });

  const traceFiles = readdirSync(TRACES_DIR).filter(
    (f) => f.endsWith(".json") && f !== "index.json",
  );

  it.each(traceFiles)("validates trace file: %s", (file) => {
    const raw = JSON.parse(readFileSync(join(TRACES_DIR, file), "utf-8"));
    const trace = MessageTrace.parse(raw);
    expect(trace.messageId).toBeTruthy();
    expect(trace.events.length).toBeGreaterThan(0);
    // Every event must be a valid MessageEvent
    for (const evt of trace.events) {
      expect(MessageEventKind.options).toContain(evt.kind);
    }
  });
});

// ---------------------------------------------------------------------------
// Golden fixture validation: scenarios
// ---------------------------------------------------------------------------

describe("golden scenario fixtures", () => {
  const scenarioDirs = readdirSync(SCENARIOS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  it.each(scenarioDirs)("validates scenario run: %s", (dir) => {
    const raw = JSON.parse(
      readFileSync(join(SCENARIOS_DIR, dir, "run.json"), "utf-8"),
    );
    const run = ScenarioRun.parse(raw);
    expect(run.scenario).toBeTruthy();
    expect(run.passed).toBe(true);
    expect(run.messageIds.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Golden fixture validation: network manifest
// ---------------------------------------------------------------------------

describe("golden network manifest", () => {
  it("validates network.json against NetworkManifest", () => {
    const raw = JSON.parse(readFileSync(NETWORK_FILE, "utf-8"));
    const manifest = NetworkManifest.parse(raw);
    expect(manifest.networkId).toBe(88888);
    expect(manifest.source.blockchainId).toBe("chain-src-001");
    expect(manifest.destination.blockchainId).toBe("chain-dst-001");
  });
});

// ---------------------------------------------------------------------------
// JSON Schema generation
// ---------------------------------------------------------------------------

describe("generateJsonSchemas", () => {
  it("produces schemas for all domain types", () => {
    const schemas = generateJsonSchemas();
    expect(schemas.MessageTrace).toHaveProperty("type", "object");
    expect(schemas.TraceIndex).toHaveProperty("type", "object");
    expect(schemas.NetworkManifest).toHaveProperty("type", "object");
    expect(schemas.ScenarioRun).toHaveProperty("type", "object");
    expect(schemas.MessageEventKind).toBeDefined();
    expect(schemas.ChainRegistryEntry).toHaveProperty("type", "object");
    expect(schemas.AppRegistryEntry).toHaveProperty("type", "object");
  });
});

// ---------------------------------------------------------------------------
// OpenAPI component bundle
// ---------------------------------------------------------------------------

describe("generateOpenAPIComponents", () => {
  it("produces a valid OpenAPI 3.1 bundle", () => {
    const bundle = generateOpenAPIComponents();
    expect(bundle.openapi).toBe("3.1.0");
    expect(bundle.info.title).toBe("Warplane Domain Schemas");
    expect(bundle.components.schemas).toHaveProperty("MessageTrace");
    expect(bundle.components.schemas).toHaveProperty("TraceIndex");
    expect(bundle.components.schemas).toHaveProperty("NetworkManifest");
    expect(bundle.components.schemas).toHaveProperty("ScenarioRun");
  });
});
