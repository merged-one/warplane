# API Runbook

The Warplane API is a local Fastify service that serves the control-plane MVP.
It reads from a local SQLite database and auto-seeds golden fixtures in demo mode.

## Quick Start

```bash
# Install and build
pnpm install && pnpm build

# Start in demo mode (auto-seeds fixtures)
pnpm dev
# → http://localhost:3100

# Or start with custom settings
PORT=4000 DB_PATH=./my.db DEMO_MODE=false pnpm dev
```

## Environment Variables

| Variable    | Default            | Description                              |
|-------------|--------------------|------------------------------------------|
| `PORT`      | `3100`             | HTTP listen port                         |
| `HOST`      | `0.0.0.0`          | Bind address                             |
| `DB_PATH`   | `data/warplane.db` | SQLite database file path                |
| `DEMO_MODE` | `true`             | Auto-seed golden fixtures if DB is empty |

## Endpoints

### System

```bash
# Health check
curl http://localhost:3100/health

# OpenAPI spec
curl http://localhost:3100/openapi.json

# Swagger UI
open http://localhost:3100/docs
```

### Registry

```bash
# List networks
curl http://localhost:3100/api/v1/network

# List chains
curl http://localhost:3100/api/v1/chains
```

### Scenarios

```bash
# List scenario runs
curl http://localhost:3100/api/v1/scenarios
```

### Traces

```bash
# List all traces (paginated)
curl http://localhost:3100/api/v1/traces

# Filter by scenario
curl 'http://localhost:3100/api/v1/traces?scenario=basic_send_receive'

# Filter by execution status
curl 'http://localhost:3100/api/v1/traces?status=success'

# Filter by chain (matches source or destination)
curl 'http://localhost:3100/api/v1/traces?chain=chain-src-001'

# Filter by source/destination specifically
curl 'http://localhost:3100/api/v1/traces?sourceBlockchainId=chain-src-001'
curl 'http://localhost:3100/api/v1/traces?destinationBlockchainId=chain-dst-001'

# Pagination
curl 'http://localhost:3100/api/v1/traces?page=1&pageSize=10'

# Get a single trace by message ID
curl http://localhost:3100/api/v1/traces/{messageId}

# Get ordered event timeline for a trace
curl http://localhost:3100/api/v1/traces/{messageId}/timeline

# Get raw trace JSON
curl http://localhost:3100/api/v1/traces/{messageId}/raw
```

### Failures

```bash
# List failed / replay-blocked / pending traces
curl http://localhost:3100/api/v1/failures
```

### Search

```bash
# Search across traces, chains, and scenarios
curl 'http://localhost:3100/api/v1/search?q=basic'
curl 'http://localhost:3100/api/v1/search?q=retry&limit=5'
```

### Import

```bash
# Import artifacts from a local directory
curl -X POST http://localhost:3100/api/v1/import \
  -H 'Content-Type: application/json' \
  -d '{"artifactsDir": "harness/tmpnet/artifacts"}'

# List import history
curl http://localhost:3100/api/v1/imports
```

## Demo Mode

When `DEMO_MODE=true` (default) and the database has zero traces, the server
automatically imports golden fixtures from `harness/tmpnet/artifacts/` on startup.
This includes 10 traces across 5 scenarios, 2 chains, and 1 network manifest.

## Database

The API uses SQLite (via `better-sqlite3`) with WAL mode. The database file
is created automatically at the `DB_PATH` location. Migrations run on startup.

To reset the database, delete the file and restart:

```bash
rm -f data/warplane.db && pnpm dev
```

## Testing

```bash
# Run all tests (includes API integration tests)
pnpm test

# Run only API tests
pnpm vitest run apps/api
```

Integration tests use an in-memory SQLite database with demo-mode seeding,
so they don't require any external setup.
