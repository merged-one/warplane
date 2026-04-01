#!/usr/bin/env node
/**
 * Generate checked-in JSON Schema and OpenAPI artifacts from Zod schemas.
 *
 * Usage: node packages/domain/scripts/generate-schemas.mjs
 *
 * Outputs:
 *   packages/domain/generated/*.schema.json
 *   packages/domain/generated/openapi-components.json
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "../generated");

async function main() {
  // Dynamic import of built output
  const domain = await import("../dist/index.js");

  mkdirSync(OUT_DIR, { recursive: true });

  // JSON Schemas
  const schemas = domain.generateJsonSchemas();
  for (const [name, schema] of Object.entries(schemas)) {
    const filename = `${name}.schema.json`;
    writeFileSync(
      join(OUT_DIR, filename),
      JSON.stringify(schema, null, 2) + "\n",
    );
    console.log(`  wrote ${filename}`);
  }

  // OpenAPI component bundle
  const openapi = domain.generateOpenAPIComponents();
  writeFileSync(
    join(OUT_DIR, "openapi-components.json"),
    JSON.stringify(openapi, null, 2) + "\n",
  );
  console.log("  wrote openapi-components.json");

  console.log("\nDone. All schemas written to packages/domain/generated/");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
