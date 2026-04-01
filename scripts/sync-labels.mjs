#!/usr/bin/env node

/**
 * Sync GitHub labels from .github/labels.json to the repository.
 *
 * Usage:
 *   node scripts/sync-labels.mjs [--dry-run]
 *
 * Requires: gh CLI authenticated with repo access.
 */

import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const labelsPath = resolve(__dirname, "../.github/labels.json");
const dryRun = process.argv.includes("--dry-run");

const labels = JSON.parse(readFileSync(labelsPath, "utf-8"));

console.log(`Syncing ${labels.length} labels${dryRun ? " (dry run)" : ""}...\n`);

for (const label of labels) {
  const args = [
    "gh",
    "label",
    "create",
    JSON.stringify(label.name),
    "--color",
    label.color,
    "--description",
    JSON.stringify(label.description),
    "--force",
  ].join(" ");

  if (dryRun) {
    console.log(`[dry-run] ${args}`);
  } else {
    try {
      execSync(args, { stdio: "inherit" });
    } catch {
      console.error(`Failed to create label: ${label.name}`);
    }
  }
}

console.log("\nDone.");
