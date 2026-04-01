/**
 * Simple poll-based watcher for local development.
 *
 * Watches an artifacts directory for changes and re-imports when
 * the trace index or scenario runs are modified.
 */

import fs from "node:fs";
import path from "node:path";
import type { Database } from "@warplane/storage";
import { importArtifacts, type ImportResult } from "./importer.js";

export interface WatchOptions {
  /** Artifacts directory to watch */
  artifactsDir: string;
  /** Poll interval in milliseconds (default: 5000) */
  intervalMs?: number;
  /** Logger (default: console.log) */
  log?: (msg: string) => void;
  /** Callback after each successful import */
  onImport?: (result: ImportResult) => void;
}

/**
 * Start polling the artifacts directory for changes.
 * Returns a stop function.
 */
export function startWatcher(
  db: Database,
  opts: WatchOptions,
): { stop: () => void } {
  const log = opts.log ?? console.log;
  const intervalMs = opts.intervalMs ?? 5000;
  const artifactsDir = path.resolve(opts.artifactsDir);

  let lastMtime = 0;
  let running = true;

  function getMaxMtime(): number {
    let maxMtime = 0;

    const check = (filePath: string) => {
      try {
        const stat = fs.statSync(filePath);
        if (stat.mtimeMs > maxMtime) maxMtime = stat.mtimeMs;
      } catch {
        // File might not exist yet
      }
    };

    // Check key sentinel files
    check(path.join(artifactsDir, "traces", "index.json"));
    check(path.join(artifactsDir, "network", "network.json"));

    // Check scenario run files
    const scenariosDir = path.join(artifactsDir, "scenarios");
    if (fs.existsSync(scenariosDir)) {
      for (const dir of fs.readdirSync(scenariosDir, { withFileTypes: true })) {
        if (dir.isDirectory()) {
          check(path.join(scenariosDir, dir.name, "run.json"));
        }
      }
    }

    return maxMtime;
  }

  async function poll(): Promise<void> {
    while (running) {
      try {
        const currentMtime = getMaxMtime();
        if (currentMtime > lastMtime) {
          log(`Change detected (mtime ${new Date(currentMtime).toISOString()}), re-importing...`);
          const result = importArtifacts(db, {
            artifactsDir,
            sourceType: "live",
            log,
          });
          lastMtime = currentMtime;
          opts.onImport?.(result);
        }
      } catch (err) {
        log(`Watcher error: ${err instanceof Error ? err.message : err}`);
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  // Initial import
  lastMtime = getMaxMtime();
  const initialResult = importArtifacts(db, {
    artifactsDir,
    sourceType: "fixture",
    log,
  });
  opts.onImport?.(initialResult);

  // Start polling
  poll();

  return {
    stop() {
      running = false;
      log("Watcher stopped.");
    },
  };
}
