# Prompting Guide for Warplane

How to get the best results when asking an AI agent about this codebase.

## Loading Context

Before asking questions, load relevant context:

1. **Start with AGENTS.md** — contains repo conventions, commands, and quality rules
2. **Load llms.txt** — for a discovery overview of all documentation
3. **Load specific files** from `docs/ai/context-map.json` based on your task

## Effective Prompts by Task

### Understanding the Project

> Read AGENTS.md and docs/product/one-pager.md. What is Warplane and what problem does it solve?

### Working on Domain Types

> Read packages/domain/src/index.ts and packages/storage/src/index.ts. I want to add a new type for validator nodes. Show me how it should fit the existing pattern.

### Planning Work

> Read docs/planning/roadmap.md, docs/planning/work-items.yaml, and docs/planning/backlog.md. Generate work items for adding a SQLite storage adapter.

### Writing an ADR

> Read docs/decisions/0001-use-structured-madr.md as an example. Write an ADR for switching from Fastify to Hono.

### Understanding Build System

> Read package.json, Makefile, and tsconfig.json. Explain the build pipeline and how packages depend on each other.

### Reviewing a Change

> Read CONTRIBUTING.md and docs/planning/working-agreement.md. Review this PR against the quality bar.

## MCP Prompts

If connected via the docs MCP server, use built-in prompts:

- `summarize-adr` — summarize any ADR by slug
- `explain-trace` — explain the domain/trace model
- `generate-task-plan` — generate tasks from a goal
- `review-runbook` — review a runbook for quality

## Tips

- The repo uses **fixture data** in M1 — no real Avalanche nodes needed
- TypeScript is **strict mode** everywhere — no `any`
- Internal deps use `workspace:*` protocol
- Every non-trivial decision should be an ADR
- Work items go in `docs/planning/work-items.yaml`
