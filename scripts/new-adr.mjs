#!/usr/bin/env node

/**
 * Scaffold a new Architecture Decision Record from the Structured MADR template.
 *
 * Usage:
 *   node scripts/new-adr.mjs "Title of decision"
 *
 * Creates docs/decisions/NNNN-slugified-title.md with the next available number.
 */

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const decisionsDir = resolve(__dirname, "../docs/decisions");
const templatePath = resolve(decisionsDir, "templates/structured-madr.md");

const title = process.argv[2];
if (!title) {
  console.error('Usage: node scripts/new-adr.mjs "Title of decision"');
  process.exit(1);
}

// Find the next ADR number
const existing = readdirSync(decisionsDir)
  .filter((f) => /^\d{4}-/.test(f))
  .map((f) => parseInt(f.slice(0, 4), 10))
  .sort((a, b) => a - b);

const nextNum = (existing.length > 0 ? existing[existing.length - 1] + 1 : 1)
  .toString()
  .padStart(4, "0");

// Slugify the title
const slug = title
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "");

const filename = `${nextNum}-${slug}.md`;
const filepath = resolve(decisionsDir, filename);

// Read template and fill in placeholders
const template = readFileSync(templatePath, "utf-8");
const today = new Date().toISOString().split("T")[0];

const content = template
  .replace("ADR-NNNN: Title", `ADR-${nextNum}: ${title}`)
  .replace("Proposed | Accepted | Deprecated | Superseded by [ADR-XXXX](XXXX-title.md)", "Proposed")
  .replace("YYYY-MM-DD", today);

writeFileSync(filepath, content, "utf-8");

console.log(`Created: docs/decisions/${filename}`);
console.log();
console.log("Next steps:");
console.log(`  1. Edit ${filepath}`);
console.log("  2. Update docs/decisions/README.md table");
console.log("  3. Update docs/planning/decision-index.md");
console.log(
  `  4. Commit: git add docs/decisions/${filename} && git commit -m "Add ADR-${nextNum}: ${title}"`,
);
