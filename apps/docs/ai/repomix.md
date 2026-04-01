# Repomix Context Packing

Repomix creates single-file bundles of the repository optimized for LLM context windows.

## Usage

```bash
# Full bundle (source + docs + config)
pnpm ai:pack

# Docs-only bundle (markdown + YAML only)
pnpm ai:pack:docs
```

## What Gets Packed

### Full Bundle (`repomix.config.json`)

- `AGENTS.md`, `README.md`, `CONTRIBUTING.md`
- Root config: `package.json`, `tsconfig.base.json`, `Makefile`
- All package source: `packages/*/src/**/*.ts`
- API server source: `apps/api/src/**/*.ts`
- Web app source: `apps/web/src/**/*.{ts,tsx}`
- All documentation: `docs/**/*.md`, `docs/**/*.yaml`
- AI docs: `docs/ai/**/*.json`
- Build scripts: `scripts/*.mjs`, `scripts/*.sh`
- Go harness: `harness/tmpnet/*.go`

### Docs Bundle (`repomix-docs.config.json`)

- `AGENTS.md`, `README.md`, `CONTRIBUTING.md`
- All documentation: `docs/**/*.md`, `docs/**/*.yaml`
- AI docs: `docs/ai/**/*.json`
- VitePress content: `apps/docs/**/*.md`
- MCP server docs: `packages/docs-mcp/README.md`

## Configuration

Both configs are at the repo root:

- `repomix.config.json` — full bundle
- `repomix-docs.config.json` — docs-only bundle

## Excluded

Build output (`dist/`), lock files, node_modules, `.env` files, generated llms files, and repomix output files are always excluded.

## When to Use What

| Need | Method |
|------|--------|
| Quick project overview | `llms.txt` |
| Full docs in one shot | `llms-full.txt` |
| Interactive doc access | MCP server (`pnpm mcp:docs`) |
| Full repo for deep work | `pnpm ai:pack` |
| Just docs for review | `pnpm ai:pack:docs` |
