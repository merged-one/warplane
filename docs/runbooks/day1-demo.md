# Seeded Demo — Warplane Dashboard

Quick walkthrough for demoing the local Teleporter trace dashboard with seeded data.

## Prerequisites

- Node >= 20, pnpm >= 10
- Repo cloned and dependencies installed (`pnpm install`)

## Setup

```bash
# 1. Seed the database with golden fixtures
pnpm db:seed

# 2. Start the API server (port 3000)
pnpm dev

# 3. In a second terminal, start the web dashboard (port 5180)
pnpm --filter @warplane/web dev
```

Open **http://localhost:5180** in a browser.

## Pages to Demo

### Overview (`/`)

- **Demo banner** at top explains fixture-seeded data
- **Summary cards**: trace count, chains registered, networks, scenario pass/fail
- **Trace status breakdown**: clickable badges (success, retry_success, failed, replay_blocked, pending)
- **Chain registry table**: lists source and destination chains with blockchain IDs
- **Scenario coverage**: shows all 5 scenarios with pass/fail, linked message IDs
- **Recent traces**: top 5 traces with quick links to detail view

### Traces (`/traces`)

- **Filters**: dropdown for scenario, status, and a message ID prefix search
- **Paginated table**: message ID (linked), scenario, status badge, source/dest, event count, send time
- Click any message ID to navigate to the detail page

### Trace Detail (`/traces/:messageId`)

- **Breadcrumb** navigation back to traces list
- **Summary cards**: scenario, source, destination, event count
- **Addresses section**: message ID, sender, recipient, relayer
- **Transaction hashes**: source tx, relay tx, destination tx
- **Fee info** (when present): token, initial/added/total amounts
- **Retry info** (when present): original/retry gas limits, retry tx hash
- **Event timeline**: vertical timeline with event badges
  - Key markers highlighted in orange: `execution_failed`, `retry_succeeded`, `fee_added`, `receipts_sent`, `replay_blocked`
- **Raw JSON toggle**: expand to see full trace payload, copy-friendly

### Failures (`/failures`)

- Lists all traces with status `failed`, `replay_blocked`, or `pending`
- Each card shows marker events (execution_failed, retry_requested, etc.) with timestamps
- Click through to detail page

### Scenarios (`/scenarios`)

- Table of all scenario runs with pass/fail, message count, timing, tags, errors
- Links to filtered trace view per scenario

### Docs (`/docs`)

- Getting started steps
- Key concept definitions
- API endpoint reference table
- Links to Swagger UI and OpenAPI spec

## Demo Walkthrough

1. **Start on Overview** — show the summary cards and status breakdown
2. **Click a failed status badge** — navigates to traces filtered by `failed`
3. **Open the `retry_failed_execution` trace** — show the event timeline with `execution_failed` and `retry_succeeded` markers
4. **Toggle raw JSON** — show the full payload
5. **Go to Failures page** — show all anomalous traces in one view
6. **Visit Scenarios** — show 5/5 scenarios with coverage
7. **Show Docs page** — reference for API endpoints and quickstart

## Expected Data (Golden Fixtures)

| Scenario                    | Status         | Traces |
| --------------------------- | -------------- | ------ |
| basic_send_receive          | success        | 2      |
| add_fee                     | success        | 1      |
| specified_receipts          | success        | 1      |
| retry_failed_execution      | retry_success  | 2      |
| replay_or_duplicate_blocked | replay_blocked | 2      |

## Known Rough Edges

- No WebSocket/SSE for live updates — manual refresh required
- No client-side routing fallback for production builds (needs server-side SPA config)
- Timestamps display in browser locale — no timezone selector yet
- Pagination is basic (no jump-to-page)
- Search page not yet wired into the dashboard nav (available via API at `/api/v1/search?q=`)

## Architecture

```
apps/web/        React 19 + Vite SPA
  src/api.ts     API client (fetch-based, no external deps)
  src/hooks.ts   useFetch hook with loading/error/reload
  src/pages/     One component per route
  src/components/ Shared: Layout, StatusBadge, EventBadge, DemoBanner
apps/api/        Fastify REST API (port 3000)
  SQLite DB      data/warplane.db (auto-created on first run)
```
