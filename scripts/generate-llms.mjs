#!/usr/bin/env node
/* eslint-disable no-undef */

/**
 * Generate llms.txt and llms-full.txt from the docs structure.
 *
 * llms.txt  — discovery file with titles, summaries, and links
 * llms-full.txt — full content of all key docs pages
 * docs/ai/context-map.json — machine-readable index of important files
 *
 * Usage: node scripts/generate-llms.mjs
 *
 * Output is deterministic: same input docs produce identical output.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");

// --- Configuration ---

/** Docs pages grouped by section for llms.txt */
const SECTIONS = [
  {
    title: "Product",
    pages: [
      { path: "docs/product/one-pager.md", desc: "Product vision, target users, and key capabilities" },
    ],
  },
  {
    title: "Architecture",
    pages: [
      { path: "packages/domain/src/index.ts", desc: "Core domain types: ChainId, Subnet, HealthStatus, ChainStatus" },
      { path: "packages/storage/src/index.ts", desc: "Storage interfaces for chain state persistence" },
      { path: "packages/ingest/src/index.ts", desc: "Data ingestion pipeline stub" },
    ],
  },
  {
    title: "Planning",
    pages: [
      { path: "docs/planning/roadmap.md", desc: "Milestone breakdown and timeline" },
      { path: "docs/planning/status.md", desc: "Current milestone progress" },
      { path: "docs/planning/work-items.yaml", desc: "Machine-readable task tracking" },
      { path: "docs/planning/backlog.md", desc: "Deferred items for future milestones" },
      { path: "docs/planning/risk-register.md", desc: "Known risks and mitigations" },
      { path: "docs/planning/working-agreement.md", desc: "Coding standards and conventions" },
    ],
  },
  {
    title: "Architecture Decisions",
    pages: [
      { path: "docs/decisions/README.md", desc: "ADR index and process" },
      { path: "docs/decisions/0001-use-structured-madr.md", desc: "ADR-0001: Use Structured MADR" },
      { path: "docs/decisions/0002-use-monorepo-with-ts-and-go.md", desc: "ADR-0002: Monorepo with TS + Go" },
      { path: "docs/decisions/0003-fixture-first-day1-mvp.md", desc: "ADR-0003: Fixture-first MVP" },
    ],
  },
  {
    title: "Governance",
    pages: [
      { path: "CONTRIBUTING.md", desc: "How to contribute, quality bar, monorepo conventions" },
      { path: "SECURITY.md", desc: "Vulnerability disclosure process" },
      { path: "RELEASE.md", desc: "Versioning and release steps" },
    ],
  },
  {
    title: "AI & Agents",
    pages: [
      { path: "AGENTS.md", desc: "Agent conventions, repo map, and quality rules" },
      { path: "docs/ai/README.md", desc: "AI-facing documentation index" },
      { path: "docs/ai/prompting-guide.md", desc: "How to prompt effectively about this repo" },
      { path: "docs/ai/repo-map.md", desc: "Machine-friendly repo structure map" },
      { path: "docs/ai/mcp-usage.md", desc: "How to use the docs MCP server" },
      { path: "docs/ai/repomix.md", desc: "AI context packing with Repomix" },
    ],
  },
];

/** Files to include in llms-full.txt (in order) */
const FULL_CONTENT_FILES = [
  "README.md",
  "AGENTS.md",
  "docs/product/one-pager.md",
  "docs/planning/roadmap.md",
  "docs/planning/status.md",
  "docs/planning/working-agreement.md",
  "docs/planning/backlog.md",
  "docs/planning/risk-register.md",
  "docs/decisions/README.md",
  "docs/decisions/0001-use-structured-madr.md",
  "docs/decisions/0002-use-monorepo-with-ts-and-go.md",
  "docs/decisions/0003-fixture-first-day1-mvp.md",
  "CONTRIBUTING.md",
  "packages/domain/src/index.ts",
  "packages/storage/src/index.ts",
  "packages/ingest/src/index.ts",
  "apps/api/src/index.ts",
  "packages/cli/src/index.ts",
  "docs/ai/README.md",
  "docs/ai/prompting-guide.md",
  "docs/ai/repo-map.md",
  "docs/ai/mcp-usage.md",
  "docs/ai/repomix.md",
];

/** Context map entries for docs/ai/context-map.json */
const CONTEXT_MAP_ENTRIES = [
  { path: "README.md", role: "Project overview and quick start", priority: "high" },
  { path: "AGENTS.md", role: "Agent conventions and repo map", priority: "high" },
  { path: "CONTRIBUTING.md", role: "Contribution guidelines and quality bar", priority: "high" },
  { path: "docs/product/one-pager.md", role: "Product vision and target users", priority: "high" },
  { path: "docs/planning/roadmap.md", role: "Milestone breakdown", priority: "high" },
  { path: "docs/planning/status.md", role: "Current milestone progress", priority: "medium" },
  { path: "docs/planning/work-items.yaml", role: "Machine-readable task tracking", priority: "medium" },
  { path: "docs/planning/backlog.md", role: "Deferred items", priority: "medium" },
  { path: "docs/planning/risk-register.md", role: "Known risks", priority: "medium" },
  { path: "docs/planning/working-agreement.md", role: "Coding standards", priority: "high" },
  { path: "docs/decisions/README.md", role: "ADR index", priority: "medium" },
  { path: "docs/decisions/0001-use-structured-madr.md", role: "ADR: Structured MADR", priority: "low" },
  { path: "docs/decisions/0002-use-monorepo-with-ts-and-go.md", role: "ADR: Monorepo structure", priority: "medium" },
  { path: "docs/decisions/0003-fixture-first-day1-mvp.md", role: "ADR: Fixture-first approach", priority: "medium" },
  { path: "packages/domain/src/index.ts", role: "Core domain types", priority: "high" },
  { path: "packages/storage/src/index.ts", role: "Storage interfaces", priority: "medium" },
  { path: "packages/ingest/src/index.ts", role: "Ingest pipeline", priority: "medium" },
  { path: "apps/api/src/index.ts", role: "API server entry point", priority: "high" },
  { path: "apps/web/src/App.tsx", role: "Web dashboard root component", priority: "medium" },
  { path: "packages/cli/src/index.ts", role: "CLI entry point", priority: "medium" },
  { path: "packages/docs-mcp/src/index.ts", role: "MCP docs server", priority: "medium" },
  { path: "harness/tmpnet/main.go", role: "Go test harness", priority: "low" },
  { path: "package.json", role: "Root workspace config and scripts", priority: "high" },
  { path: "tsconfig.base.json", role: "Base TypeScript config", priority: "low" },
  { path: "Makefile", role: "Build orchestration", priority: "medium" },
  { path: "docs/ai/context-map.json", role: "Machine-readable file index", priority: "high" },
];

// --- Helpers ---

function readFile(relPath) {
  const abs = join(ROOT, relPath);
  if (!existsSync(abs)) return null;
  return readFileSync(abs, "utf-8");
}

// --- Generators ---

function generateLlmsTxt() {
  const lines = [];
  lines.push("# Warplane");
  lines.push("");
  lines.push("> Interchain Control Plane for Avalanche L1s. Observe, manage, and orchestrate");
  lines.push("> Avalanche L1 subnets from a single pane of glass.");
  lines.push("");
  lines.push("Warplane is a TypeScript + Go monorepo providing unified observability, lifecycle");
  lines.push("management, and cross-chain orchestration for Avalanche subnet operators.");
  lines.push("");

  for (const section of SECTIONS) {
    lines.push(`## ${section.title}`);
    lines.push("");
    for (const page of section.pages) {
      if (existsSync(join(ROOT, page.path))) {
        lines.push(`- [${page.path}](${page.path}): ${page.desc}`);
      }
    }
    lines.push("");
  }

  lines.push("## Optional — Lower Priority");
  lines.push("");
  lines.push("- [SECURITY.md](SECURITY.md): Vulnerability disclosure process");
  lines.push("- [RELEASE.md](RELEASE.md): Versioning and release steps");
  lines.push("- [CODEOWNERS](CODEOWNERS): Code ownership routing");
  lines.push("- [.github/PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md): PR checklist");
  lines.push("");

  return lines.join("\n");
}

function generateLlmsFullTxt() {
  const lines = [];
  lines.push("# Warplane — Full Documentation Context");
  lines.push("");
  lines.push("> Complete documentation for LLM consumption. Generated deterministically from source docs.");
  lines.push("");

  for (const filePath of FULL_CONTENT_FILES) {
    const content = readFile(filePath);
    if (!content) continue;
    lines.push(`---`);
    lines.push(`## File: ${filePath}`);
    lines.push("");
    lines.push(content.trim());
    lines.push("");
  }

  return lines.join("\n");
}

function generateContextMap() {
  const entries = CONTEXT_MAP_ENTRIES.filter((e) => existsSync(join(ROOT, e.path))).map((e) => ({
    path: e.path,
    role: e.role,
    priority: e.priority,
    exists: true,
  }));

  return JSON.stringify({ version: 1, files: entries }, null, 2);
}

// --- Main ---

// Ensure output directories exist
mkdirSync(join(ROOT, "docs", "ai"), { recursive: true });

const llmsTxt = generateLlmsTxt();
const llmsFullTxt = generateLlmsFullTxt();
const contextMap = generateContextMap();

writeFileSync(join(ROOT, "llms.txt"), llmsTxt);
writeFileSync(join(ROOT, "llms-full.txt"), llmsFullTxt);
writeFileSync(join(ROOT, "docs", "ai", "context-map.json"), contextMap);

console.log("Generated:");
console.log(`  llms.txt          (${llmsTxt.length} bytes)`);
console.log(`  llms-full.txt     (${llmsFullTxt.length} bytes)`);
console.log(`  docs/ai/context-map.json (${contextMap.length} bytes)`);
