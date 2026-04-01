# Prompting Guide

Effective prompt patterns for working with the Warplane codebase using AI coding agents.

## Getting Started

Always start a session by loading context:

```
Read AGENTS.md and llms.txt, then summarize what you know about this project.
```

Or use the MCP server:

```
Use the warplane-docs MCP server to read the roadmap and current status.
```

## Effective Patterns

### Understanding the Project

```
Explain the Warplane architecture based on the domain types in packages/domain
and the storage interfaces in packages/storage.
```

### Working with Domain Types

```
I need to add a new domain type for validator tracking. Look at how ChainId and
ChainStatus are defined in packages/domain/src/index.ts and follow the same
patterns (readonly properties, explicit types, factory function).
```

### Planning Work

```
Read docs/planning/roadmap.md, status.md, and backlog.md. What should I work on
next for Milestone 2? Create work items in YAML format matching work-items.yaml.
```

### Writing ADRs

```
I want to decide between SQLite and PostgreSQL for chain state storage. Create an
ADR following the Structured MADR template in docs/decisions/templates/. Look at
existing ADRs for style reference.
```

### Understanding the Build System

```
Explain how the build system works: pnpm workspaces, TypeScript project
references, the Makefile, and how packages depend on each other.
```

### Reviewing Changes

```
Review my changes against the quality rules in AGENTS.md. Check that build,
test, and lint pass. Flag any TypeScript conventions I'm violating.
```

## MCP Server Prompts

The docs MCP server provides built-in prompts:

| Prompt | Use Case |
|--------|----------|
| `summarize-adr` | Quick summary of any ADR by slug |
| `explain-trace` | Understand the data flow model |
| `generate-task-plan` | Plan tasks aligned with the roadmap |
| `review-runbook` | Check a runbook for accuracy |

## Tips

- **Fixture data**: All data in M1 is fixture-based. Don't assume real RPC calls work yet.
- **Strict TypeScript**: This repo uses TypeScript strict mode. No `any`, use `unknown` and narrow.
- **Workspace protocol**: Internal deps use `workspace:*`, not version numbers.
- **Composite builds**: TypeScript uses project references (`tsc -b`), not standalone compilation.
