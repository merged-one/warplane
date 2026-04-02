# Storage & Ingestion Runbook

Local persistence layer and artifact ingestion pipeline for the Warplane control plane.

## Architecture

```
harness/tmpnet/artifacts/    ──→  @warplane/ingest  ──→  @warplane/storage (SQLite)
  ├── network/network.json          validates via            ├── networks
  ├── traces/*.json                 @warplane/domain         ├── chains
  ├── traces/index.json             Zod schemas              ├── traces
  └─�� scenarios/*/run.json                                   ├── events
                                                             ├── scenario_runs
                                                             ├── artifacts
                                                             └── import_history
```

## Database

SQLite via `better-sqlite3`. WAL mode enabled by default for concurrent read access.

Default database file: `warplane.db` in the project root.

### Schema

| Table            | Purpose                                                |
| ---------------- | ------------------------------------------------------ |
| `networks`       | Network manifests (full JSON + indexed fields)         |
| `chains`         | Chain registry entries (one row per blockchain ID)     |
| `traces`         | Message traces with denormalized fields for filtering  |
| `events`         | Timeline events, ordered by sequence within each trace |
| `scenario_runs`  | Test scenario execution records                        |
| `artifacts`      | Raw file path references for all imported artifacts    |
| `import_history` | Import run tracking with counts and status             |
| `migrations`     | Applied migration tracking                             |

### Key design decisions

- **Traces store full JSON** (`trace_json`) for lossless reconstruction, plus denormalized columns for indexed queries (scenario, execution, source/dest chain, timestamps).
- **Events are separate rows** to enable cross-trace timeline queries ordered by timestamp.
- **Idempotent upserts** use `ON CONFLICT ... DO UPDATE` — re-importing the same data is a no-op.
- **Import history** records every import run for auditability.

## Commands

### Run migrations

```bash
pnpm db:migrate              # Uses default warplane.db
pnpm db:migrate -- custom.db # Specify a different path
```

### Seed with golden fixtures

```bash
pnpm db:seed
# Equivalent to:
pnpm ingest:fixtures
```

This imports all committed golden traces from `harness/tmpnet/artifacts/` into `warplane.db`.

### Watch mode (local development)

```bash
pnpm ingest:watch
```

Polls the artifacts directory every 5 seconds and re-imports on changes. Useful during active harness development.

### Inspect the database

```bash
sqlite3 warplane.db
sqlite> .tables
sqlite> SELECT scenario, execution, send_time FROM traces ORDER BY send_time;
sqlite> SELECT kind, timestamp, message_id FROM events ORDER BY timestamp;
```

## Migration system

Migrations live in `packages/storage/src/migrations/` as numbered SQL files (e.g., `001_initial.sql`).

The runner:

1. Reads all `.sql` files in sorted order
2. Skips any already recorded in the `migrations` table
3. Executes new ones in a transaction
4. Records them as applied

To add a new migration, create `002_your_change.sql` in the migrations directory.

## Ingestion pipeline

### Import flow

1. **Start import** — records source directory and type in `import_history`
2. **Import network** — validates `network/network.json` via `NetworkManifest.parse()`, upserts network + chains
3. **Import traces** ��� reads `traces/index.json`, validates each trace file via `MessageTrace.parse()`, upserts traces + events
4. **Import scenarios** — reads `scenarios/*/run.json`, validates via `ScenarioRun.parse()`, upserts scenario runs
5. **Complete import** — updates `import_history` with counts and status

All validation uses `@warplane/domain` Zod schemas. Invalid data fails the import rather than writing garbage.

### Programmatic usage

```typescript
import { openDb, runMigrations } from "@warplane/storage";
import { importArtifacts } from "@warplane/ingest";

const db = openDb({ path: "warplane.db" });
runMigrations(db);

const result = importArtifacts(db, {
  artifactsDir: "harness/tmpnet/artifacts",
});

console.log(result);
// { importId: 1, networks: 1, chains: 2, scenarios: 5, traces: 10, events: 52, errors: [] }
```

### Querying

```typescript
import { openDb, runMigrations, listTraces, getTimeline } from "@warplane/storage";

const db = openDb({ path: "warplane.db" });

// Filter traces by scenario
const retries = listTraces(db, { scenario: "retry_failed_execution" });

// Filter by execution status
const failures = listTraces(db, { execution: "failed" });

// Cross-trace timeline
const timeline = getTimeline(db, { scenario: "basic_send_receive" });
```

## Testing

```bash
pnpm test   # Runs all tests including storage + ingest
```

Tests use in-memory SQLite databases (`:memory:`) — no cleanup needed.

### What the tests cover

- Migration idempotency
- Network/chain/scenario/trace CRUD
- Idempotent re-import of golden fixtures
- Event ordering within traces
- Cross-trace timeline chronological ordering
- Filtering by scenario and execution status
- Import history lifecycle tracking
