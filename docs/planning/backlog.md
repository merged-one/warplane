# Backlog -- Deferred and Future Work

Items listed here are recognized as needed but explicitly deferred from the current
milestone. Organized by target milestone. See [roadmap.md](roadmap.md) for the full plan
and [work-items.yaml](work-items.yaml) for machine-readable tracking.

## Milestone 2 (Fuji Alpha -- target Aug 31, 2026)

### P0 -- Critical path

- **RPC polling ingestion** (WP-101): `eth_getLogs` for all 8 TeleporterMessenger events + WebSocket for block headers
- **Event normalization pipeline** (WP-104): Convert raw logs + metrics into canonical 11-event MessageEvent objects
- **Per-message tracing UI** (WP-105): Lifecycle timeline with real-time updates

### P1 -- High value

- **Relayer Prometheus metrics** (WP-102): 15 metrics from port 9090 (relay success/failure counts, latency, checkpoints)
- **Sig-agg Prometheus metrics** (WP-103): 11 metrics from port 8081 (aggregation latency, validator timeouts, stake weight)
- **Relayer operations panel** (WP-106): Health, lag, failure classification dashboard
- **Webhook alerting** (WP-107): Push notifications for failed/delayed cross-chain flows
- **Docker Compose** (WP-108): Self-hosted deployment with API + web + ingest worker
- **Fuji deployment guide** (WP-109): Step-by-step for connecting to Fuji testnet
- **E2E test wiring** (WP-110): Real tmpnet integration for `make e2e`

### P2 -- Nice to have

- **Postgres adapter** (WP-111): Production-ready persistence option alongside SQLite

## Milestone 3 (Policy Engine -- target Nov 15, 2026)

### P0 -- Core policy and remediation

- **Allowed relayer enforcement** (WP-201): Declarative policy per route, violation alerts
- **Fee floor detection** (WP-202): Underfunded message identification and alerting
- **Replay-safe retry** (WP-205): CLI/API to trigger `retryMessageExecution` with pre-flight checks

### P1 -- Extended policy and ops

- **Retry windows and route allowlists** (WP-203)
- **Circuit breakers** (WP-204): Failure-rate triggers, auto-pause, manual/auto reset
- **Fee top-up workflow** (WP-206): CLI/API for `AddFeeAmount`
- **Channel pause/relayer failover** (WP-207)
- **Environment promotion** (WP-208): Export/import config across local/Fuji/mainnet
- **Audit log** (WP-209): Timestamped record of all operator actions

### P2 -- Team features

- **Roles and permissions** (WP-210): Admin/viewer roles, API key auth

## Milestone 4 (Public Beta -- target Jan 31, 2027)

- **Security hardening** (WP-301): Input validation, rate limiting, dependency audit
- **Public documentation** (WP-302): API reference, quickstarts, architecture docs
- **VRF cross-L1 reference integration** (WP-303): Concrete ecosystem use case
- **Starter templates** (WP-304): 3+ example apps for different use cases
- **Partner pilots** (WP-305): At least 1 public or 2 private pilots
- **Dashboard search and SPA routing** (WP-306): Search in nav, deep link support

## Future (Post-M4)

- **MCP docs server enhancements**: Auth, network transports, additional resources
- **Go linter integration**: golangci-lint in CI
- **Test coverage thresholds**: Enforced per package
- **AvaCloud Webhooks integration**: If Teleporter-native events are added to the API
- **TeleporterMessengerV2 support**: Multi-verification scheme event model
- **Multi-tenancy**: Shared hosted deployment for multiple teams
- **Mainnet production deployment**: Managed hosted service option
