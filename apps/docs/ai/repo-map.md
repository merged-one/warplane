# Repo Map

Machine-friendly map of the Warplane repository structure. Use this to orient yourself quickly.

## Package Overview

| Package               | Path                 | Role                                                         | Exports         |
| --------------------- | -------------------- | ------------------------------------------------------------ | --------------- |
| `@warplane/api`       | `apps/api/`          | Fastify REST API server                                      | —               |
| `@warplane/web`       | `apps/web/`          | React + Vite dashboard                                       | —               |
| `@warplane/docs-site` | `apps/docs/`         | VitePress documentation                                      | —               |
| `@warplane/domain`    | `packages/domain/`   | Core types: ChainId, Subnet, HealthStatus, ChainStatus       | `dist/index.js` |
| `@warplane/storage`   | `packages/storage/`  | Persistence interfaces: ChainStatusReader, ChainStatusWriter | `dist/index.js` |
| `@warplane/ingest`    | `packages/ingest/`   | Data ingestion pipeline (polling chain health)               | `dist/index.js` |
| `@warplane/cli`       | `packages/cli/`      | CLI tool (`warplane` binary)                                 | `dist/index.js` |
| `@warplane/docs-mcp`  | `packages/docs-mcp/` | MCP documentation server (stdio)                             | `dist/index.js` |

## Dependency Graph

```
@warplane/api ──────► @warplane/domain
@warplane/storage ──► @warplane/domain
@warplane/ingest ───► @warplane/domain
@warplane/cli ──────► @warplane/domain
@warplane/web         (standalone)
@warplane/docs-site   (standalone)
@warplane/docs-mcp    (@modelcontextprotocol/sdk, zod)
```

## Directory Layout

```
warplane/
├── apps/
│   ├── api/            Fastify server (port 3100)
│   ├── web/            React dashboard (Vite)
│   └── docs/           VitePress documentation site
├── packages/
│   ├── domain/         Core domain types (ChainId, Subnet, HealthStatus, ChainStatus)
│   ├── storage/        Persistence interfaces (ChainStatusReader, ChainStatusWriter)
│   ├── ingest/         Data ingestion (pollChainHealth)
│   ├── cli/            CLI binary (warplane ping)
│   └── docs-mcp/       MCP server (stdio)
├── harness/
│   └── tmpnet/         Go test harness for Avalanche tmpnet
├── docs/
│   ├── planning/       Roadmap, status, work-items, backlog, risk register
│   ├── decisions/      Architecture Decision Records (MADR)
│   ├── product/        Product one-pager
│   └── ai/             AI-facing docs, context map, prompting guide
├── scripts/            Build, demo, and generation scripts
├── AGENTS.md           Agent conventions
├── llms.txt            LLM discovery file (generated)
├── llms-full.txt       Full docs for LLMs (generated)
└── repomix.config.json Repomix packing config
```

## Key Config Files

| File                       | Purpose                                         |
| -------------------------- | ----------------------------------------------- |
| `package.json`             | Root workspace config and scripts               |
| `pnpm-workspace.yaml`      | Workspace member globs (`apps/*`, `packages/*`) |
| `tsconfig.json`            | Root project references (composite)             |
| `tsconfig.base.json`       | Shared TS options (ES2022, strict, Node16)      |
| `vitest.config.ts`         | Test runner config                              |
| `eslint.config.js`         | Linting rules                                   |
| `prettier.config.js`       | Formatting rules                                |
| `Makefile`                 | Build orchestration (pnpm + Go)                 |
| `repomix.config.json`      | AI context packing (full)                       |
| `repomix-docs.config.json` | AI context packing (docs only)                  |
