# Repomix — AI Context Packing

Repomix packs the repo into AI-friendly bundles for use with LLMs that don't support MCP.

## Quick Start

```bash
# Pack core source + docs
pnpm ai:pack

# Pack docs only
pnpm ai:pack:docs
```

## What Gets Packed

### Default Bundle (`ai:pack`)

- All TypeScript source files (`packages/*/src/**`, `apps/*/src/**`)
- Documentation (`docs/**/*.md`, `docs/**/*.yaml`)
- Root config files (`package.json`, `tsconfig.json`, `Makefile`, etc.)
- Agent docs (`AGENTS.md`, `docs/ai/**`)
- Schemas and type definitions

### Docs Bundle (`ai:pack:docs`)

- All markdown documentation
- Work items and planning YAML
- ADRs and governance docs
- AI-facing docs

### Excluded

- `node_modules/`, `dist/`, `.git/`
- Build output and cache directories
- Lock files (`pnpm-lock.yaml`)
- Environment files (`.env*`)
- VitePress cache and build output

## Configuration

The `repomix.config.json` at the repo root controls what gets packed. Edit it to adjust includes/excludes.

## Output

Bundles are written to stdout by default. Redirect to a file:

```bash
pnpm ai:pack > warplane-context.txt
pnpm ai:pack:docs > warplane-docs.txt
```

## When to Use

- **repomix** — when pasting repo context into an LLM chat
- **llms.txt** — when the LLM supports llms.txt discovery
- **MCP server** — when the LLM client supports MCP (best experience)
