# MCP Documentation Server

The `@warplane/docs-mcp` package exposes Warplane documentation through the Model Context Protocol (MCP) over stdio transport.

## Setup

```bash
# Build the server
pnpm --filter @warplane/docs-mcp run build

# Run it
pnpm mcp:docs
```

## Claude Code Configuration

Add to `.claude/settings.json` or project-level `.claude.json`:

```json
{
  "mcpServers": {
    "warplane-docs": {
      "command": "node",
      "args": ["packages/docs-mcp/dist/index.js"],
      "cwd": "/path/to/warplane"
    }
  }
}
```

## Resources

The server exposes these resources for direct reading:

| URI                                                  | Content                                       |
| ---------------------------------------------------- | --------------------------------------------- |
| `warplane://docs/docs/planning/roadmap.md`           | Project roadmap                               |
| `warplane://docs/docs/planning/status.md`            | Milestone status                              |
| `warplane://docs/docs/planning/backlog.md`           | Deferred items                                |
| `warplane://docs/docs/planning/risk-register.md`     | Risk register                                 |
| `warplane://docs/docs/planning/working-agreement.md` | Coding standards                              |
| `warplane://docs/docs/planning/work-items.yaml`      | Work items (YAML)                             |
| `warplane://adrs/{slug}`                             | ADR by slug (e.g. `0001-use-structured-madr`) |
| `warplane://schemas/domain`                          | Core domain types (TypeScript)                |
| `warplane://schemas/storage`                         | Storage interfaces (TypeScript)               |
| `warplane://docs/product/one-pager`                  | Product vision                                |
| `warplane://source/api`                              | API server source                             |

## Prompts

| Name                 | Description                               | Arguments                       |
| -------------------- | ----------------------------------------- | ------------------------------- |
| `summarize-adr`      | Summarize an architecture decision record | `slug`: ADR filename slug       |
| `explain-trace`      | Explain the trace model and data flow     | (none)                          |
| `generate-task-plan` | Plan tasks based on roadmap and backlog   | `goal`: feature or goal to plan |
| `review-runbook`     | Review a runbook for completeness         | `content`: runbook text         |

## Tools

| Name               | Description                             | Arguments            |
| ------------------ | --------------------------------------- | -------------------- |
| `search_docs`      | Full-text search across all docs        | `query`: search text |
| `list_adrs`        | List all ADRs with status               | (none)               |
| `get_trace_schema` | Get domain types and storage interfaces | (none)               |

## Example Session

```
> Use search_docs to find information about chain health
> Use list_adrs to see all architecture decisions
> Use the summarize-adr prompt with slug "0002-use-monorepo-with-ts-and-go"
> Use get_trace_schema to understand the domain model
```
