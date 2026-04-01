# AGENTS.md Guide

`AGENTS.md` is the primary entry point for coding agents working in this repo. It lives at the repo root and is automatically loaded by tools like Claude Code, Cursor, and Copilot Workspace.

## What It Contains

- **Project summary** — what Warplane is and its tech stack
- **Repo structure** — directory layout with package descriptions
- **Key commands** — build, test, lint, dev, demo, docs, and AI scripts
- **Quality rules** — the bar every PR must clear
- **TypeScript conventions** — strict mode, readonly, explicit returns, no `any`
- **Go conventions** — gofmt, go vet, test file naming
- **Commit message format** — imperative mood with type prefixes
- **ADR process** — how to create architecture decision records
- **Work tracking** — where to find roadmap, status, backlog, and risk register
- **MCP server** — how to start and use the docs MCP server
- **AI context** — pointers to llms.txt, context-map.json, and other AI docs

## How Agents Should Use It

1. **Read it first** before making any changes
2. **Follow the quality rules** — build, test, and check must pass
3. **Use the conventions** — TypeScript strict mode, explicit returns, workspace protocol
4. **Check the work tracking** — understand what's in progress before making changes
5. **Reference the command table** — use the right commands for the right tasks

## Keeping It Updated

AGENTS.md should always reflect the actual state of the repo. When adding new scripts, packages, or conventions, update AGENTS.md to match. The `pnpm docs:llms` command includes AGENTS.md in the generated artifacts.
