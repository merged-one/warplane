/**
 * @warplane/docs-mcp — MCP server exposing warplane documentation.
 *
 * Provides resources, prompts, and tools for LLM-powered documentation access.
 * Runs over stdio transport.
 *
 * Usage:
 *   pnpm mcp:docs
 *   node packages/docs-mcp/dist/index.js
 */

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

// Resolve repo root (two levels up from packages/docs-mcp/src/)
const REPO_ROOT = resolve(import.meta.dirname, "..", "..", "..");

// --- Helpers ---

function readRepoFile(relPath: string): string | null {
  const abs = join(REPO_ROOT, relPath);
  if (!existsSync(abs)) return null;
  return readFileSync(abs, "utf-8");
}

function listMarkdownFiles(dir: string): string[] {
  const abs = join(REPO_ROOT, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => `${dir}/${f}`);
}

function listAdrFiles(): string[] {
  return listMarkdownFiles("docs/decisions").filter((f) => /\/\d{4}-/.test(f));
}

function searchDocs(query: string): Array<{ path: string; matches: string[] }> {
  const results: Array<{ path: string; matches: string[] }> = [];
  const dirs = ["docs/planning", "docs/decisions", "docs/product", "docs/ai"];
  const rootFiles = ["README.md", "CONTRIBUTING.md", "AGENTS.md", "SECURITY.md", "RELEASE.md"];
  const queryLower = query.toLowerCase();

  const allFiles = [...rootFiles, ...dirs.flatMap((d) => listMarkdownFiles(d))];

  for (const filePath of allFiles) {
    const content = readRepoFile(filePath);
    if (!content) continue;
    const lines = content.split("\n");
    const matches = lines.filter((line) => line.toLowerCase().includes(queryLower));
    if (matches.length > 0) {
      results.push({ path: filePath, matches: matches.slice(0, 5) });
    }
  }

  return results;
}

// --- Server Setup ---

const server = new McpServer({
  name: "warplane-docs",
  version: "0.0.1",
});

// --- Resources ---

// Planning docs
for (const file of [
  "docs/planning/roadmap.md",
  "docs/planning/status.md",
  "docs/planning/backlog.md",
  "docs/planning/risk-register.md",
  "docs/planning/working-agreement.md",
  "docs/planning/work-items.yaml",
]) {
  const name = file.replace(/[/.]/g, "-");
  server.registerResource(
    name,
    `warplane://docs/${file}`,
    { title: file, description: `Planning doc: ${file}`, mimeType: "text/markdown" },
    async (uri) => {
      const content = readRepoFile(file) ?? `File not found: ${file}`;
      return { contents: [{ uri: uri.href, text: content }] };
    },
  );
}

// ADRs as a dynamic resource
server.registerResource(
  "adr",
  new ResourceTemplate("warplane://adrs/{slug}", {
    list: async () => ({
      resources: listAdrFiles().map((f) => {
        const filename = f.split("/").pop() ?? f;
        const slug = filename.replace(".md", "");
        return {
          uri: `warplane://adrs/${slug}`,
          name: slug,
        };
      }),
    }),
  }),
  { title: "Architecture Decision Record", mimeType: "text/markdown" },
  async (uri, variables) => {
    const slug = variables.slug as string;
    const file = `docs/decisions/${slug}.md`;
    const content = readRepoFile(file) ?? `ADR not found: ${slug}`;
    return { contents: [{ uri: uri.href, text: content }] };
  },
);

// Schemas (domain types)
server.registerResource(
  "domain-types",
  "warplane://schemas/domain",
  {
    title: "Domain types",
    description: "Core domain types from @warplane/domain",
    mimeType: "text/typescript",
  },
  async (uri) => {
    const content = readRepoFile("packages/domain/src/index.ts") ?? "File not found";
    return { contents: [{ uri: uri.href, text: content }] };
  },
);

// Storage interfaces
server.registerResource(
  "storage-interfaces",
  "warplane://schemas/storage",
  {
    title: "Storage interfaces",
    description: "Persistence interfaces from @warplane/storage",
    mimeType: "text/typescript",
  },
  async (uri) => {
    const content = readRepoFile("packages/storage/src/index.ts") ?? "File not found";
    return { contents: [{ uri: uri.href, text: content }] };
  },
);

// Product one-pager
server.registerResource(
  "product-one-pager",
  "warplane://docs/product/one-pager",
  {
    title: "Product one-pager",
    description: "Product vision and key capabilities",
    mimeType: "text/markdown",
  },
  async (uri) => {
    const content = readRepoFile("docs/product/one-pager.md") ?? "File not found";
    return { contents: [{ uri: uri.href, text: content }] };
  },
);

// API source
server.registerResource(
  "api-source",
  "warplane://source/api",
  {
    title: "API server source",
    description: "Fastify API server entry point",
    mimeType: "text/typescript",
  },
  async (uri) => {
    const content = readRepoFile("apps/api/src/index.ts") ?? "File not found";
    return { contents: [{ uri: uri.href, text: content }] };
  },
);

// --- Prompts ---

server.registerPrompt(
  "summarize-adr",
  {
    title: "Summarize ADR",
    description: "Summarize an architecture decision record",
    argsSchema: {
      slug: z.string().describe("ADR filename slug, e.g. '0001-use-structured-madr'"),
    },
  },
  async ({ slug }) => {
    const content = readRepoFile(`docs/decisions/${slug}.md`) ?? `ADR not found: ${slug}`;
    return {
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Summarize this Architecture Decision Record concisely. Include the status, context, decision, and key consequences.\n\n${content}`,
          },
        },
      ],
    };
  },
);

server.registerPrompt(
  "explain-trace",
  {
    title: "Explain Trace Model",
    description: "Explain the Warplane trace model and domain types",
    argsSchema: {},
  },
  async () => {
    const domainTypes = readRepoFile("packages/domain/src/index.ts") ?? "";
    const storageTypes = readRepoFile("packages/storage/src/index.ts") ?? "";
    return {
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Explain the Warplane trace model based on these domain and storage types. Describe how chain health observations flow through the system.\n\nDomain types:\n${domainTypes}\n\nStorage interfaces:\n${storageTypes}`,
          },
        },
      ],
    };
  },
);

server.registerPrompt(
  "generate-task-plan",
  {
    title: "Generate Task Plan",
    description: "Generate a task plan based on the current roadmap and backlog",
    argsSchema: {
      goal: z.string().describe("The goal or feature to plan"),
    },
  },
  async ({ goal }) => {
    const roadmap = readRepoFile("docs/planning/roadmap.md") ?? "";
    const backlog = readRepoFile("docs/planning/backlog.md") ?? "";
    const workItems = readRepoFile("docs/planning/work-items.yaml") ?? "";
    return {
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Generate a task plan for the following goal, considering the current roadmap, backlog, and work items. Output structured work items in YAML format matching the existing schema.\n\nGoal: ${goal}\n\nRoadmap:\n${roadmap}\n\nBacklog:\n${backlog}\n\nExisting work items:\n${workItems}`,
          },
        },
      ],
    };
  },
);

server.registerPrompt(
  "review-runbook",
  {
    title: "Review Runbook",
    description: "Review a runbook for completeness and accuracy",
    argsSchema: {
      content: z.string().describe("The runbook content to review"),
    },
  },
  async ({ content }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Review this runbook for completeness, accuracy, and clarity. Check that all commands are correct for this monorepo (pnpm workspaces + Go). Suggest improvements.\n\n${content}`,
        },
      },
    ],
  }),
);

// --- Tools ---

server.registerTool(
  "search_docs",
  {
    title: "Search Docs",
    description: "Search across all documentation files for a query string",
    inputSchema: {
      query: z.string().describe("Text to search for in docs"),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ query }) => {
    const results = searchDocs(query);
    if (results.length === 0) {
      return { content: [{ type: "text", text: `No results found for: "${query}"` }] };
    }
    const text = results
      .map((r) => `### ${r.path}\n${r.matches.map((m) => `  - ${m.trim()}`).join("\n")}`)
      .join("\n\n");
    return { content: [{ type: "text", text }] };
  },
);

server.registerTool(
  "list_adrs",
  {
    title: "List ADRs",
    description: "List all architecture decision records",
    inputSchema: {},
    annotations: { readOnlyHint: true },
  },
  async () => {
    const files = listAdrFiles();
    if (files.length === 0) {
      return { content: [{ type: "text", text: "No ADRs found." }] };
    }
    const text = files
      .map((f) => {
        const content = readRepoFile(f);
        const title = content?.match(/^#\s+(.+)$/m)?.[1] ?? f;
        const status = content?.match(/^##\s+Status\s*\n+(.+)$/m)?.[1] ?? "Unknown";
        return `- **${title}** (${status}) — \`${f}\``;
      })
      .join("\n");
    return { content: [{ type: "text", text }] };
  },
);

server.registerTool(
  "get_trace_schema",
  {
    title: "Get Trace Schema",
    description: "Get the domain types and storage interfaces that define the trace model",
    inputSchema: {},
    annotations: { readOnlyHint: true },
  },
  async () => {
    const domain = readRepoFile("packages/domain/src/index.ts") ?? "Not found";
    const storage = readRepoFile("packages/storage/src/index.ts") ?? "Not found";
    return {
      content: [
        {
          type: "text",
          text: `## Domain Types (packages/domain/src/index.ts)\n\n\`\`\`typescript\n${domain}\n\`\`\`\n\n## Storage Interfaces (packages/storage/src/index.ts)\n\n\`\`\`typescript\n${storage}\n\`\`\``,
        },
      ],
    };
  },
);

// --- Start ---

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("MCP server failed:", err);
  process.exit(1);
});
