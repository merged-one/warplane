# AI & Agent Documentation

Warplane provides first-class support for AI coding agents and LLMs interacting with the codebase. This section documents how to configure and use the AI-facing artifacts.

## Quick Start for Agents

1. **Read `AGENTS.md`** at the repo root for conventions, quality rules, and repo structure
2. **Load `llms.txt`** for a structured overview of all documentation with links
3. **Start the MCP server** with `pnpm mcp:docs` for interactive documentation access
4. **Pack context** with `pnpm ai:pack` to get a full repo bundle for your context window

## Artifacts

| Artifact                   | Purpose                               | Command             |
| -------------------------- | ------------------------------------- | ------------------- |
| `AGENTS.md`                | Coding agent conventions and repo map | —                   |
| `llms.txt`                 | LLM discovery file with links         | `pnpm docs:llms`    |
| `llms-full.txt`            | Full documentation content for LLMs   | `pnpm docs:llms`    |
| `docs/ai/context-map.json` | Machine-readable file index           | `pnpm docs:llms`    |
| MCP server                 | Interactive docs, search, ADRs        | `pnpm mcp:docs`     |
| Repomix bundle             | Full repo context pack                | `pnpm ai:pack`      |
| Docs-only bundle           | Documentation context pack            | `pnpm ai:pack:docs` |

## Sections

- [AGENTS.md Guide](./agents-md) — What's in AGENTS.md and how agents should use it
- [Prompting Guide](./prompting-guide) — Effective prompt patterns for this repo
- [Repo Map](./repo-map) — Machine-friendly repo structure
- [MCP Server](./mcp-usage) — Using the docs MCP server
- [Repomix Packing](./repomix) — Creating AI context bundles
- [llms.txt](./llms-txt) — How the llms.txt artifacts work
