/**
 * Artifact importer — reads harness artifact directories and upserts
 * them into the storage layer with domain validation.
 *
 * Supports:
 * - Network manifests (network/network.json)
 * - Trace files (traces/{id}.json + traces/index.json)
 * - Scenario runs (scenarios/{name}/run.json)
 *
 * All data is validated through @warplane/domain Zod schemas before writing.
 * Import is idempotent: re-importing the same artifacts is a no-op.
 */

import fs from "node:fs";
import path from "node:path";
import {
  NetworkManifest,
  MessageTrace,
  ScenarioRun,
  TraceIndex,
} from "@warplane/domain";
import {
  type Database,
  upsertNetwork,
  upsertChain,
  upsertScenarioRun,
  upsertTrace,
  upsertArtifact,
  startImport,
  completeImport,
  failImport,
} from "@warplane/storage";

export interface ImportResult {
  importId: number;
  networks: number;
  chains: number;
  scenarios: number;
  traces: number;
  events: number;
  errors: string[];
}

export interface ImportOptions {
  /** Root artifact directory (e.g. harness/tmpnet/artifacts) */
  artifactsDir: string;
  /** Source type label for import history */
  sourceType?: string;
  /** Logger function (default: console.log) */
  log?: (msg: string) => void;
}

/**
 * Import all artifacts from a directory into the database.
 */
export function importArtifacts(db: Database, opts: ImportOptions): ImportResult {
  const log = opts.log ?? console.log;
  const artifactsDir = path.resolve(opts.artifactsDir);

  if (!fs.existsSync(artifactsDir)) {
    throw new Error(`Artifacts directory not found: ${artifactsDir}`);
  }

  const importId = startImport(db, artifactsDir, opts.sourceType ?? "fixture");
  const result: ImportResult = {
    importId,
    networks: 0,
    chains: 0,
    scenarios: 0,
    traces: 0,
    events: 0,
    errors: [],
  };

  try {
    // Wrap the entire import in a transaction for atomicity
    const doImport = db.transaction(() => {
      // 1. Import network manifest
      importNetwork(db, artifactsDir, importId, result, log);

      // 2. Import traces
      importTraces(db, artifactsDir, importId, result, log);

      // 3. Import scenario runs
      importScenarios(db, artifactsDir, importId, result, log);
    });

    doImport();

    completeImport(db, importId, {
      networks: result.networks,
      chains: result.chains,
      scenarios: result.scenarios,
      traces: result.traces,
      events: result.events,
    });

    log(
      `Import complete: ${result.networks} networks, ${result.chains} chains, ` +
      `${result.scenarios} scenarios, ${result.traces} traces, ${result.events} events`,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    failImport(db, importId, msg);
    result.errors.push(msg);
    log(`Import failed: ${msg}`);
  }

  return result;
}

function importNetwork(
  db: Database,
  artifactsDir: string,
  importId: number,
  result: ImportResult,
  log: (msg: string) => void,
): void {
  const manifestPath = path.join(artifactsDir, "network", "network.json");
  if (!fs.existsSync(manifestPath)) {
    log("No network manifest found, skipping.");
    return;
  }

  const raw = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  const parsed = NetworkManifest.parse(raw);

  const networkDbId = upsertNetwork(db, parsed);
  result.networks++;

  // Register artifact
  upsertArtifact(db, {
    type: "network_manifest",
    path: manifestPath,
    description: `Network ${parsed.networkId}`,
    importId,
  });

  // Extract chains from source/destination
  for (const chain of [parsed.source, parsed.destination]) {
    upsertChain(db, chain, networkDbId);
    result.chains++;
  }

  // Additional chains array if present
  if (parsed.chains) {
    for (const chain of parsed.chains) {
      upsertChain(db, chain, networkDbId);
      result.chains++;
    }
  }

  log(`Imported network ${parsed.networkId} with ${result.chains} chains`);
}

function importTraces(
  db: Database,
  artifactsDir: string,
  importId: number,
  result: ImportResult,
  log: (msg: string) => void,
): void {
  const tracesDir = path.join(artifactsDir, "traces");
  if (!fs.existsSync(tracesDir)) {
    log("No traces directory found, skipping.");
    return;
  }

  // Read trace index if it exists
  const indexPath = path.join(tracesDir, "index.json");
  let traceFiles: string[] = [];

  if (fs.existsSync(indexPath)) {
    const rawIndex = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
    const index = TraceIndex.parse(rawIndex);
    traceFiles = [...new Set(index.traces.map((t) => t.file))];
  } else {
    // Fall back to scanning directory
    traceFiles = fs
      .readdirSync(tracesDir)
      .filter((f) => f.endsWith(".json") && f !== "index.json");
  }

  for (const file of traceFiles) {
    const filePath = path.join(tracesDir, file);
    if (!fs.existsSync(filePath)) {
      result.errors.push(`Trace file not found: ${filePath}`);
      continue;
    }

    try {
      const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      const trace = MessageTrace.parse(raw);

      const traceId = upsertTrace(db, trace, importId);
      result.traces++;
      result.events += trace.events.length;

      upsertArtifact(db, {
        type: "trace",
        path: filePath,
        description: `Trace ${trace.messageId.slice(0, 12)}... (${trace.scenario})`,
        traceId,
        importId,
      });
    } catch (err) {
      const msg = `Failed to import trace ${file}: ${err instanceof Error ? err.message : err}`;
      result.errors.push(msg);
      log(msg);
    }
  }

  // Handle duplicate scenarios in index (e.g. replay_or_duplicate_blocked)
  // The trace file is the same but the index has different scenario/execution entries.
  // We import the same file under different scenario names.
  if (fs.existsSync(indexPath)) {
    const rawIndex = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
    const index = TraceIndex.parse(rawIndex);

    for (const entry of index.traces) {
      const filePath = path.join(tracesDir, entry.file);
      if (!fs.existsSync(filePath)) continue;

      try {
        const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        const baseTrace = MessageTrace.parse(raw);

        // If the index entry has a different scenario than the trace file,
        // upsert with the index scenario/execution override
        if (entry.scenario !== baseTrace.scenario || entry.execution !== baseTrace.execution) {
          const overrideTrace = { ...baseTrace, scenario: entry.scenario, execution: entry.execution };
          upsertTrace(db, overrideTrace as MessageTrace, importId);
          result.traces++;
          result.events += baseTrace.events.length;
        }
      } catch {
        // Already reported above
      }
    }
  }

  log(`Imported ${result.traces} traces with ${result.events} events`);
}

function importScenarios(
  db: Database,
  artifactsDir: string,
  importId: number,
  result: ImportResult,
  log: (msg: string) => void,
): void {
  const scenariosDir = path.join(artifactsDir, "scenarios");
  if (!fs.existsSync(scenariosDir)) {
    log("No scenarios directory found, skipping.");
    return;
  }

  const scenarioDirs = fs
    .readdirSync(scenariosDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const dir of scenarioDirs) {
    const runPath = path.join(scenariosDir, dir, "run.json");
    if (!fs.existsSync(runPath)) continue;

    try {
      const raw = JSON.parse(fs.readFileSync(runPath, "utf-8"));
      const run = ScenarioRun.parse(raw);
      upsertScenarioRun(db, run, importId);
      result.scenarios++;

      upsertArtifact(db, {
        type: "scenario_run",
        path: runPath,
        description: `Scenario ${run.scenario} (${run.passed ? "passed" : "failed"})`,
        importId,
      });
    } catch (err) {
      const msg = `Failed to import scenario ${dir}: ${err instanceof Error ? err.message : err}`;
      result.errors.push(msg);
      log(msg);
    }
  }

  log(`Imported ${result.scenarios} scenario runs`);
}
