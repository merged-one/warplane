# @warplane/docs-mcp

MCP (Model Context Protocol) server exposing Warplane documentation for LLM consumption.

## Quick Start

```bash
# Build
pnpm --filter @warplane/docs-mcp run build

# Run (stdio transport)
pnpm mcp:docs
# or directly:
node packages/docs-mcp/dist/index.js
```

## Configuration for Claude Code

Add to your Claude Code MCP config (`.claude/settings.json` or `~/.claude/settings.json`):

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

| URI | Description |
|-----|-------------|
| `warplane://docs/docs/planning/roadmap.md` | Project roadmap |
| `warplane://docs/docs/planning/status.md` | Milestone status |
| `warplane://docs/docs/planning/backlog.md` | Deferred items |
| `warplane://docs/docs/planning/risk-register.md` | Risk register |
| `warplane://docs/docs/planning/working-agreement.md` | Coding standards |
| `warplane://docs/docs/planning/work-items.yaml` | Work items (YAML) |
| `warplane://adrs/{slug}` | ADR by slug (e.g. `0001-use-structured-madr`) |
| `warplane://schemas/domain` | Core domain types |
| `warplane://schemas/storage` | Storage interfaces |
| `warplane://docs/product/one-pager` | Product vision |
| `warplane://source/api` | API server source |

## Prompts

| Name | Description | Args |
|------|-------------|------|
| `summarize-adr` | Summarize an ADR | `slug` |
| `explain-trace` | Explain the trace model | (none) |
| `generate-task-plan` | Plan tasks from roadmap/backlog | `goal` |
| `review-runbook` | Review a runbook | `content` |

## Tools

| Name | Description | Args |
|------|-------------|------|
| `search_docs` | Full-text search across docs | `query` |
| `list_adrs` | List all ADRs with status | (none) |
| `get_trace_schema` | Get domain + storage types | (none) |

## Architecture

- Built on `@modelcontextprotocol/sdk` (stdio transport)
- Reads docs from the repo filesystem at runtime
- No auth or network transport — stdio only for Milestone 1
- Resources, prompts, and tools are registered at startup
