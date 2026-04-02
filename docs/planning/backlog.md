# Backlog — Intentionally Deferred

Items listed here are recognized as needed but explicitly deferred from Milestone 1.

## Infrastructure

- **Docker Compose**: local dev environment with API + web + database
- **e2e test wiring**: `make e2e` currently prints a stub; needs tmpnet integration

## Features

- **Real chain polling**: `@warplane/ingest` returns static data; needs Avalanche RPC client
- **Storage implementations**: `@warplane/storage` defines interfaces only; needs SQLite/Postgres adapter
- **CLI commands beyond `ping`**: status, deploy, logs, config
- **MCP docs server enhancements**: auth, network transports, additional resources (OpenAPI, trace samples), SSE transport
- **Web dashboard data fetching**: React app is a static shell; needs API client and state management

## Quality

- **Test coverage thresholds**
- **Go linter (golangci-lint) integration**
