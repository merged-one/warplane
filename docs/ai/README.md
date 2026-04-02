# AI-Facing Documentation

This directory contains documentation optimized for AI agents and LLMs working with the Warplane codebase.

## Files

| File                                     | Purpose                                                             |
| ---------------------------------------- | ------------------------------------------------------------------- |
| [context-map.json](context-map.json)     | Machine-readable index of important files with roles and priorities |
| [prompting-guide.md](prompting-guide.md) | How to prompt effectively about this repo                           |
| [repo-map.md](repo-map.md)               | Detailed repo structure and package descriptions                    |
| [mcp-usage.md](mcp-usage.md)             | How to use the docs MCP server                                      |
| [repomix.md](repomix.md)                 | How to use repomix for AI context packing                           |

## Quick Context Loading

For LLMs that support llms.txt:

- `llms.txt` (repo root) — discovery file with links and descriptions
- `llms-full.txt` (repo root) — full documentation content

For MCP-capable agents:

- Run `pnpm mcp:docs` to start the docs MCP server
- See [mcp-usage.md](mcp-usage.md) for configuration

For repomix bundles:

- Run `pnpm ai:pack` to generate a context bundle
- See [repomix.md](repomix.md) for details

## Regenerating Artifacts

```bash
pnpm docs:llms          # regenerate llms.txt, llms-full.txt, context-map.json
pnpm ai:pack            # regenerate AI context bundle
pnpm ai:pack:docs       # pack docs only
```
