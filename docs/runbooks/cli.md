# CLI Runbook

> Operating the Warplane Interchain Control Plane from the terminal.

## Quick Start

```bash
# Build the CLI
pnpm -F @warplane/cli build

# Check your environment
warplane doctor

# Start the API in demo mode (seeds golden fixtures automatically)
pnpm dev

# In another terminal — explore data
warplane traces list
warplane traces show <messageId>
warplane failures list
warplane scenarios list
warplane registry show
```

## Installation

The CLI is part of the monorepo. After `pnpm install && pnpm build`, the `warplane` binary is available via:

```bash
# Direct invocation
node packages/cli/dist/index.js <command>

# Or via pnpm (links the bin)
pnpm -F @warplane/cli exec warplane <command>
```

For global-like access, add `node_modules/.bin` to your PATH or use `npx`.

## Global Options

| Option            | Description                                                  |
| ----------------- | ------------------------------------------------------------ |
| `--json`          | Output JSON instead of tables (for scripting)                |
| `--api-url <url>` | Override the API base URL (default: `http://localhost:3100`) |
| `-V, --version`   | Show CLI version                                             |
| `-h, --help`      | Show help                                                    |

The API URL can also be set via the `WARPLANE_API_URL` environment variable.

## Commands

### `warplane doctor`

Checks local environment readiness. Verifies:

- Node.js version (>= 20)
- pnpm installation
- Go installation (optional, for E2E harness)
- Database file presence
- API reachability
- Golden fixtures availability
- docs-mcp build status
- tmpnet harness prerequisites (optional)

Exit code 0 if all required checks pass. Optional checks (Go, tmpnet) show warnings but don't fail.

```bash
warplane doctor          # TTY output with colored symbols
warplane --json doctor   # Machine-readable JSON
```

### `warplane demo seed`

Seeds the running API with golden fixture data by calling `POST /api/v1/import`.

```bash
warplane demo seed
```

**Prerequisite:** The API must be running (`pnpm dev`).

### `warplane demo start`

Starts the API server in demo mode (foreground process).

```bash
warplane demo start              # default port 3100
warplane demo start --port 8080  # custom port
```

### `warplane traces list`

Lists message traces with optional filters.

```bash
warplane traces list
warplane traces list --scenario basic_send_receive
warplane traces list --status success
warplane traces list --chain chain-src-001
warplane traces list -n 5                          # limit results
warplane --json traces list                        # JSON output
```

### `warplane traces show <messageId>`

Shows detailed trace information including timeline, relayer info, fees, and retry state.

Supports partial message IDs — the CLI will search for a matching trace.

```bash
warplane traces show 4d8580870bf0d1c3...  # full ID
warplane traces show 4d858                # partial ID prefix
warplane --json traces show 4d858         # JSON with timeline
```

### `warplane failures list`

Lists traces with non-success execution status (failed, replay_blocked, pending).

```bash
warplane failures list
warplane failures list --scenario retry_failed_execution
warplane --json failures list
```

### `warplane scenarios list`

Lists all scenario runs with pass/fail status and message counts.

```bash
warplane scenarios list
warplane --json scenarios list
```

### `warplane import <artifactDir>`

Imports trace artifacts from a local directory via the API.

```bash
warplane import harness/tmpnet/artifacts
warplane import /path/to/artifacts --source-type ci-run
warplane --json import harness/tmpnet/artifacts
```

### `warplane registry show`

Shows the chain registry and network topology.

```bash
warplane registry show
warplane --json registry show
```

### `warplane docs mcp`

Starts the docs MCP server (stdio transport) for LLM integration.

```bash
warplane docs mcp           # start the server
warplane docs mcp --check   # just check if it's built
```

### `warplane completion [shell]`

Outputs shell completion scripts for bash, zsh, or fish.

```bash
# Bash
eval "$(warplane completion bash)"

# Zsh
eval "$(warplane completion zsh)"

# Fish
warplane completion fish > ~/.config/fish/completions/warplane.fish
```

## JSON Mode

All list and show commands support `--json` for machine-readable output:

```bash
# Pipe to jq
warplane --json traces list | jq '.traces[].messageId'

# Use in scripts
TRACE_COUNT=$(warplane --json traces list | jq '.total')

# Check doctor programmatically
warplane --json doctor | jq '.ok'
```

## When the API Is Not Running

If the API is unreachable, the CLI shows a helpful message with next steps:

```
Cannot reach the API at http://localhost:3100

  The local API server does not appear to be running.
  Start it with:

    pnpm dev          # dev mode with auto-reload
    pnpm -F api start # production build

  Or set WARPLANE_API_URL to point to a running instance.
```

## Architecture

The CLI talks exclusively to the local REST API (`/api/v1/*`). It does not access the SQLite database directly. This ensures:

1. Consistent behavior whether the API was seeded manually or via demo mode
2. The CLI and web UI always see the same data
3. Database schema changes only need to be handled in one place

The only exception is `warplane doctor`, which checks for the database file and local fixtures on disk (read-only).

## Troubleshooting

| Problem                         | Solution                                                                      |
| ------------------------------- | ----------------------------------------------------------------------------- |
| `Cannot reach the API`          | Start the API: `pnpm dev`                                                     |
| `No trace found matching "…"`   | Check the message ID prefix — use `warplane traces list` to see available IDs |
| `Directory not found` (import)  | Provide an absolute path or a path relative to the repo root                  |
| `MCP server not built`          | Build it: `pnpm -F docs-mcp build`                                            |
| Doctor shows go/tmpnet warnings | These are optional — only needed for E2E harness development                  |
