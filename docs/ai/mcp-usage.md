# Using the Docs MCP Server

The `@warplane/docs-mcp` package provides an MCP server that exposes Warplane documentation to LLM-powered tools.

## Setup

### Build

```bash
pnpm --filter @warplane/docs-mcp run build
```

### Run

```bash
pnpm mcp:docs
```

Or directly:

```bash
node packages/docs-mcp/dist/index.js
```

### Configure in Claude Code

Add to `.claude/settings.json`:

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

## Available Resources

### Planning Documents

Read the roadmap, status, backlog, risk register, or working agreement:

```
warplane://docs/docs/planning/roadmap.md
warplane://docs/docs/planning/status.md
warplane://docs/docs/planning/backlog.md
warplane://docs/docs/planning/risk-register.md
warplane://docs/docs/planning/working-agreement.md
warplane://docs/docs/planning/work-items.yaml
```

### Architecture Decision Records

List and read ADRs by slug:

```
warplane://adrs/0001-use-structured-madr
warplane://adrs/0002-use-monorepo-with-ts-and-go
warplane://adrs/0003-fixture-first-day1-mvp
```

### Schemas and Source

```
warplane://schemas/domain     — Core domain types
warplane://schemas/storage    — Storage interfaces
warplane://source/api         — API server source
warplane://docs/product/one-pager — Product vision
```

## Available Prompts

| Prompt | Description | Args |
|--------|-------------|------|
| `summarize-adr` | Summarize an ADR | `slug`: ADR filename slug |
| `explain-trace` | Explain the trace/domain model | (none) |
| `generate-task-plan` | Plan tasks for a goal | `goal`: what to plan |
| `review-runbook` | Review runbook quality | `content`: runbook text |

## Available Tools

| Tool | Description | Args |
|------|-------------|------|
| `search_docs` | Search all docs for a query | `query`: search text |
| `list_adrs` | List all ADRs with status | (none) |
| `get_trace_schema` | Get domain + storage types | (none) |

## Example Session

Once configured, an agent can:

1. Call `list_adrs` to see all architecture decisions
2. Call `search_docs` with query "fixture" to find fixture-related docs
3. Use the `summarize-adr` prompt with slug "0003-fixture-first-day1-mvp"
4. Read `warplane://schemas/domain` for the current type definitions
