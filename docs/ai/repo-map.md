# Repo Map

Machine-friendly map of the Warplane repository structure.

## Packages

### apps/api — @warplane/api
- **Role:** Fastify REST API server
- **Entry:** `src/index.ts`
- **Endpoints:** `/healthz`, `/api/v1/chains`
- **Depends on:** `@warplane/domain`
- **Test:** `src/index.test.ts`

### apps/web — @warplane/web
- **Role:** React + Vite dashboard shell
- **Entry:** `src/main.tsx`
- **Component:** `src/App.tsx`
- **Build:** Vite (not tsc)

### apps/docs — @warplane/docs-site
- **Role:** VitePress documentation site
- **Config:** `.vitepress/config.ts`
- **Home:** `index.md`
- **Build:** VitePress

### packages/domain — @warplane/domain
- **Role:** Core domain types and validation
- **Entry:** `src/index.ts`
- **Exports:** `ChainId`, `Subnet`, `HealthStatus`, `ChainStatus`, `chainId()`
- **Test:** `src/index.test.ts`

### packages/storage — @warplane/storage
- **Role:** Persistence interfaces
- **Entry:** `src/index.ts`
- **Exports:** `ChainStatusReader`, `ChainStatusWriter`, `ChainStatusStore`
- **Depends on:** `@warplane/domain`

### packages/ingest — @warplane/ingest
- **Role:** Data ingestion pipeline (fixture data in M1)
- **Entry:** `src/index.ts`
- **Exports:** `pollChainHealth()`
- **Depends on:** `@warplane/domain`

### packages/cli — @warplane/cli
- **Role:** Command-line tool
- **Entry:** `src/index.ts`
- **Commands:** `ping`
- **Depends on:** `@warplane/domain`

### packages/docs-mcp — @warplane/docs-mcp
- **Role:** MCP server for documentation access
- **Entry:** `src/index.ts`
- **Transport:** stdio
- **Dependencies:** `@modelcontextprotocol/sdk`, `zod`

### harness/tmpnet
- **Role:** Go test harness for Avalanche tmpnet
- **Entry:** `main.go`
- **Test:** `main_test.go`
- **Language:** Go

## Documentation

| Path | Content |
|------|---------|
| `docs/planning/roadmap.md` | Milestone breakdown |
| `docs/planning/status.md` | Current progress |
| `docs/planning/work-items.yaml` | Machine-readable tasks |
| `docs/planning/backlog.md` | Deferred items |
| `docs/planning/risk-register.md` | Known risks |
| `docs/planning/working-agreement.md` | Coding standards |
| `docs/decisions/*.md` | Architecture Decision Records |
| `docs/product/one-pager.md` | Product vision |
| `docs/ai/` | AI-facing docs and context map |

## Config Files

| File | Purpose |
|------|---------|
| `package.json` | Root workspace scripts and deps |
| `pnpm-workspace.yaml` | Workspace member globs |
| `tsconfig.json` | Root project references |
| `tsconfig.base.json` | Shared TS compiler options |
| `vitest.config.ts` | Test runner config |
| `eslint.config.js` | Linting rules |
| `prettier.config.js` | Formatting rules |
| `Makefile` | Build orchestration (Node + Go) |
| `.editorconfig` | Editor settings |
| `.nvmrc` | Node version (20) |

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/demo-day1.sh` | M1 demo runner |
| `scripts/generate-llms.mjs` | Generate llms.txt artifacts |
| `scripts/docs-llms.sh` | Shell wrapper for llms generation |
| `scripts/ai-pack.sh` | AI context bundle generator |
| `scripts/new-adr.mjs` | ADR scaffolding |
| `scripts/sync-labels.mjs` | GitHub label sync |
