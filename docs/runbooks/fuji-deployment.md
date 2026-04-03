# Fuji Testnet Deployment Guide

Deploy Warplane to monitor Teleporter cross-chain messages on the Avalanche Fuji testnet.

## Prerequisites

- Docker >= 24 and Docker Compose >= 2.20
- A Fuji RPC endpoint (public or private)
- Git

## Quick Start

```bash
# Clone the repository
git clone https://github.com/AshAvalanche/warplane.git
cd warplane

# Create configuration
cp config/fuji-example.yaml config/warplane.yaml

# Start Warplane
docker compose up -d

# Verify health
curl http://localhost:3000/healthz
```

The dashboard is accessible at `http://localhost:3000`.

## Configuration

### Chain Configuration (YAML)

Edit `config/warplane.yaml` to define the chains to monitor:

```yaml
chains:
  - name: "Fuji C-Chain"
    blockchainId: "yH8D7ThNJkxmtkuv2jgBa4P1Rn3Qpr4pPr7QYNfcdoS6k6HWp"
    evmChainId: 43113
    rpcUrl: "https://api.avax-test.network/ext/bc/C/rpc"
    wsUrl: "wss://api.avax-test.network/ext/bc/C/ws"
    teleporterAddress: "0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf"
    startBlock: 0
```

### Environment Variables

| Variable                       | Default                | Description                                  |
| ------------------------------ | ---------------------- | -------------------------------------------- |
| `WARPLANE_PORT`                | `3000`                 | Host port for the dashboard and API          |
| `WARPLANE_CONFIG`              | `config/warplane.yaml` | Path to YAML config file                     |
| `DB_PATH`                      | `/data/warplane.db`    | SQLite database path                         |
| `WARPLANE_LOG_LEVEL`           | `info`                 | Log level (`debug`, `info`, `warn`, `error`) |
| `DEMO_MODE`                    | `false`                | Enable demo mode with fixture data           |
| `WARPLANE_RELAYER_METRICS_URL` | -                      | Relayer Prometheus metrics endpoint          |
| `WARPLANE_SIGAGG_METRICS_URL`  | -                      | Signature aggregator metrics endpoint        |

Override environment variables via a `.env` file:

```bash
cp .env.example .env
# Edit .env with your values
```

## Adding Custom L1 Chains

Add additional chain entries to your `config/warplane.yaml`:

```yaml
chains:
  - name: "Fuji C-Chain"
    blockchainId: "yH8D7ThNJkxmtkuv2jgBa4P1Rn3Qpr4pPr7QYNfcdoS6k6HWp"
    evmChainId: 43113
    rpcUrl: "https://api.avax-test.network/ext/bc/C/rpc"
    teleporterAddress: "0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf"
    startBlock: 0

  - name: "My L1"
    blockchainId: "<your-blockchain-id>"
    evmChainId: <your-chain-id>
    rpcUrl: "https://your-l1-rpc-endpoint"
    teleporterAddress: "0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf"
    startBlock: 0
```

Restart after config changes:

```bash
docker compose restart warplane
```

## Monitoring

### Dashboard

The web dashboard at `http://localhost:3000` provides:

- **Overview** — Trace counts, chain registry, scenario coverage
- **Traces** — Filterable list of cross-chain messages with status
- **Failures** — Failed/pending/blocked messages with failure markers
- **Relayer** — Relayer health metrics and latency stats

### Pipeline Status

Check ingestion progress via the API:

```bash
curl http://localhost:3000/api/v1/pipeline/status
```

Returns chain sync status, event counts, and pipeline statistics.

### Health Check

```bash
curl http://localhost:3000/healthz
```

## Connecting Relayer & Sig-Agg Metrics

If you run an AWM relayer or signature aggregator alongside Warplane, connect their Prometheus metrics endpoints:

```yaml
relayer:
  metricsUrl: "http://relayer:9090/metrics"

sigagg:
  metricsUrl: "http://sigagg:8081/metrics"
```

Or via environment variables:

```bash
WARPLANE_RELAYER_METRICS_URL=http://relayer:9090/metrics
WARPLANE_SIGAGG_METRICS_URL=http://sigagg:8081/metrics
```

## Backfill

Set `startBlock` in your chain config to sync historical events from a specific block number. Set to `0` to start from the beginning (slow for mainnet), or use the Teleporter contract deployment block for faster sync.

The orchestrator automatically:

1. Backfills from `startBlock` (or last checkpoint) to chain tip
2. Transitions to live mode for real-time event monitoring
3. Persists checkpoints for crash recovery

## Troubleshooting

### RPC Rate Limiting

If you see connection errors, your RPC provider may be rate-limiting requests. Solutions:

- Use a dedicated RPC endpoint (Infura, Alchemy, or self-hosted)
- Reduce the backfill batch size in advanced config

### WebSocket Disconnects

The orchestrator falls back to HTTP polling if WebSocket connections fail. No action required, but WebSocket connections provide lower latency.

### Disk Space

SQLite databases grow with trace data. Monitor the `/data` volume:

```bash
docker exec warplane du -sh /data/
```

### Container Logs

```bash
docker compose logs -f warplane
```

## Production Considerations

### Postgres Mode

For production deployments with high throughput, use Postgres:

```bash
# Start with Postgres profile
docker compose --profile postgres up -d
```

Set the `DATABASE_URL` environment variable to point to your Postgres instance.

### Backups

For SQLite:

```bash
docker cp warplane:/data/warplane.db ./backup-$(date +%Y%m%d).db
```

### Resource Sizing

| Deployment          | CPU    | Memory | Disk  |
| ------------------- | ------ | ------ | ----- |
| Small (1-2 chains)  | 1 vCPU | 512 MB | 1 GB  |
| Medium (3-5 chains) | 2 vCPU | 1 GB   | 5 GB  |
| Large (10+ chains)  | 4 vCPU | 2 GB   | 20 GB |

### Reverse Proxy

For TLS termination, place nginx or Caddy in front of Warplane:

```nginx
server {
    listen 443 ssl;
    server_name warplane.example.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```
