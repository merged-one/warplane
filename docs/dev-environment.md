# Warplane Development Environment

Guide for running Warplane locally against live Avalanche networks.

## Quick Start

### Prerequisites

- Node.js 20+, pnpm
- Docker (for Postgres)
- `jq` (for the tip-block helper script)

### 1. Start Postgres

```bash
docker compose -f docker-compose.dev.yml up postgres -d
```

### 2. Choose a Network Config

| Config                          | Networks          | Use Case                |
| ------------------------------- | ----------------- | ----------------------- |
| `config/fuji-dev.yaml`          | Fuji testnet only | Fastest, lowest traffic |
| `config/mainnet-dev.yaml`       | Mainnet only      | Real production data    |
| `config/multi-network-dev.yaml` | Both              | Full multi-chain setup  |

### 3. Update startBlock (Important!)

The dev configs ship with a fixed startBlock. Before running, update it to a recent value:

```bash
# Get current Fuji tip
./scripts/get-tip-block.sh https://api.avax-test.network/ext/bc/C/rpc

# Get current Mainnet tip
./scripts/get-tip-block.sh https://api.avax.network/ext/bc/C/rpc
```

Subtract ~1000 from the tip for ~30 minutes of history, or ~100 for a quick startup. Edit the `startBlock` value in your chosen config file.

### 4. Run

```bash
# Fuji only
DATABASE_URL=postgresql://warplane:warplane-dev@localhost:5432/warplane \
  WARPLANE_CONFIG=config/fuji-dev.yaml \
  pnpm dev

# Mainnet only
DATABASE_URL=postgresql://warplane:warplane-dev@localhost:5432/warplane \
  WARPLANE_CONFIG=config/mainnet-dev.yaml \
  pnpm dev

# Both networks
DATABASE_URL=postgresql://warplane:warplane-dev@localhost:5432/warplane \
  WARPLANE_CONFIG=config/multi-network-dev.yaml \
  pnpm dev
```

Verify at `http://localhost:3000/api/v1/pipeline/status` — you should see chains in `backfill` or `live` mode.

## startBlock Strategy

**Never use `startBlock: 0` on Mainnet.** Avalanche Mainnet has 80M+ blocks. Backfilling from 0 would take days and generate massive RPC traffic.

The `-example.yaml` configs use `startBlock: 0` for production deployments that need full history. The `-dev.yaml` configs use recent blocks for fast dev startup.

For development:

- Subtract **100** from tip = instant startup, minimal history
- Subtract **1000** from tip = ~30 minutes of history
- Subtract **10000** from tip = ~5 hours of history

## Rate Limits

Public Avalanche RPC endpoints (`api.avax.network`, `api.avax-test.network`) handle approximately 40 requests/second. Warplane's default 2-second poll interval stays well within these limits.

For heavy backfill (>10,000 blocks), consider using a paid RPC provider:

- [Infura](https://infura.io/) (Avalanche support)
- [Alchemy](https://alchemy.com/) (Avalanche support)
- [QuickNode](https://quicknode.com/)

Set custom RPC URLs via config:

```yaml
chains:
  - name: "Mainnet C-Chain"
    rpcUrl: "https://avalanche-mainnet.infura.io/v3/YOUR_KEY"
    # ...
```

## Resetting State

To wipe the local database and start fresh:

```bash
docker compose -f docker-compose.dev.yml down -v
docker compose -f docker-compose.dev.yml up postgres -d
```

## Running Smoke Tests Locally

### TypeScript (RPC client + fetcher only)

```bash
RUN_LIVE_SMOKE=1 pnpm vitest run packages/ingest/src/rpc/live-smoke.test.ts
```

Tests `isHealthy()`, `getBlockNumber()`, and `fetchTeleporterEvents()` against real endpoints. No database needed.

### Go (Full API pipeline)

Requires Postgres running:

```bash
docker compose -f docker-compose.dev.yml up postgres -d
pnpm build

cd harness/tmpnet
DATABASE_URL=postgresql://warplane:warplane-dev@localhost:5432/warplane \
  RUN_LIVE_SMOKE=1 \
  WARPLANE_BIN=../../apps/api/dist/index.js \
  go test -v -run TestLiveSmoke -timeout 5m ./...
```

Tests start a real Warplane server against live RPCs and verify the pipeline status endpoint shows chains progressing.

### CI

Smoke tests run weekly (Monday 6:17 AM UTC) via the `live-smoke.yml` workflow. They can also be triggered manually from the GitHub Actions UI. They are separate from the main CI and do not block PRs.

## Docker Full Stack

To run everything in Docker (Postgres + Warplane API):

```bash
# Fuji
WARPLANE_CONFIG=config/fuji-dev.yaml docker compose -f docker-compose.dev.yml up

# Both networks
WARPLANE_CONFIG=config/multi-network-dev.yaml docker compose -f docker-compose.dev.yml up
```
