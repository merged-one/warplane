# Research: Blockchain Event Ingestion, Observability, and Cross-Chain Monitoring

**Date:** 2026-04-02
**Purpose:** State-of-the-art practices survey for Warplane architecture decisions

---

## 1. Blockchain Event Ingestion: eth_getLogs vs WebSocket vs Hybrid

### Production Consensus: Hybrid is Standard

Every production-grade system uses a **hybrid approach**:

- **WebSocket subscriptions (`eth_subscribe`)** for low-latency, real-time event detection
- **`eth_getLogs` polling** as backfill/catch-up mechanism for gaps after reconnects

### WebSocket Limitations (Critical)

From Geth's official documentation: subscriptions are **not suitable** for use cases that cannot afford to miss notifications:

- Subscriptions are coupled to a connection; if closed, all subscriptions are removed
- Internal buffer limit of ~10k notifications; if client can't keep up, connection is forcibly closed
- No guaranteed delivery -- events can be silently dropped

### eth_getLogs Constraints

- Alchemy: capped at 10K logs per response OR 2K block range with 150MB response limit
- Most providers impose block-range limits and max query durations
- Stateless and retryable -- inherently more reliable than subscriptions

### Library Behavior Differences

- **ethers.js** on WebSocket: uses `eth_subscribe` with topic filters (true push)
- **viem**: uses `eth_newFilter` + `eth_getFilterChanges` polling even on WebSocket connections
- Know what your library does under the hood

### Recommended Architecture

```
WebSocket (real-time) ──> Event Buffer ──> Deduplication ──> Processing
                              ^
eth_getLogs (catch-up) ───────┘  (on reconnect, fill gaps by last-processed block)
```

Key practices:

- Track last-processed block number persistently
- Automatic reconnection with exponential backoff
- Scope log filters narrowly (specific addresses + topics)
- Multi-provider failover for resilience
- Monitor provider rate limits for backpressure strategy

**Sources:**

- https://geth.ethereum.org/docs/interacting-with-geth/rpc/pubsub
- https://www.alchemy.com/docs/deep-dive-into-eth_getlogs
- https://github.com/wevm/viem/discussions/503
- https://docs.chainstack.com/docs/ethereum-logs-tutorial-series-logs-and-filters

---

## 2. Production Indexer Architectures (The Graph, Goldsky, Envio, Ponder)

### The Graph

- **Handlers:** AssemblyScript compiled to WebAssembly
- **Deployment:** Subgraphs per chain (no native multichain single-subgraph)
- **Status:** Hosted Service fully deprecated in 2026; must use decentralized Graph Network
- **Limitation:** Slowest in benchmarks; AssemblyScript has steep learning curve

### Goldsky

- **Two products:** Subgraphs (Graph-compatible GraphQL APIs) and Mirror (streaming pipelines)
- **Architecture:** Streaming-first built on Redpanda (Kafka-compatible, C++, no JVM), Apache Flink, Kubernetes
- **Why Redpanda over Kafka:** Same throughput with less hardware, single binary, 3-4x cloud savings via Tiered Storage
- **Data flow:** Control plane (config APIs) + Data plane (source extraction -> transform -> sink)
- **Mirror sinks:** PostgreSQL, Kafka, S3, ClickHouse, Snowflake, DynamoDB, Aurora
- **Reorg handling:** Self-healing, automatic detection and canonical chain correction
- **Performance:** 100,000+ RPS on single-worker pipeline
- **Transforms:** Custom TypeScript with WebAssembly execution
- **Engine:** Next-gen Rust engine (2025)
- **Note:** Shifts reorg handling responsibility to client for raw event extraction

### Envio (HyperIndex + HyperSync)

- **HyperSync:** Purpose-built Rust data retrieval layer, 2000x faster than RPC
- **Performance:** 25,000 events/sec standard; 4,472x faster than Subgraphs in benchmarks
- **Client libraries:** Python, Rust, Node.js, Go
- **HyperIndex:** Full indexing framework on top of HyperSync (schema, events, GraphQL)
- **Self-hostable:** Via Docker
- **Chain support:** 70+ EVM chains with native HyperSync; any EVM chain via RPC fallback
- **Pagination:** 5-second request time limit; advance `from_block` based on returned `end_block`
- **Server-side:** Proprietary (not open-source)

### Ponder

- **Self-hosted:** Full control, maximum customization
- **Database:** SQLite for development (`.ponder/sqlite/`), PostgreSQL for production
- **Architecture:** In-memory database during backfill, then same in-memory DB for live indexing
- **Readiness:** `/ready` endpoint returns HTTP 200 when historical indexing complete
- **Multi-instance:** Schema locking (fails on startup if lock unavailable, no more random schema names)
- **Performance:** 158x slower than Envio in benchmarks; operational overhead is significant
- **Connection pooling:** Supports full `node-postgres` poolConfig options
- **Caching:** SQL-over-HTTP queries cached, selectively invalidated on table updates
- **Experimental:** `experimental_isolated` mode isolates chains, requires `chain_id` in primary keys, uses multiple CPU cores

### Architectural Categories

| Pattern                 | Description                                    | Best For                          |
| ----------------------- | ---------------------------------------------- | --------------------------------- |
| Subgraphs (Declarative) | Schema + event-triggered mappings              | Smart contract apps, dashboards   |
| Data APIs               | Pre-built endpoints (/balances, /transactions) | Fast prototyping, wallets         |
| SQL/ETL Indexing        | Batch backfills into queryable databases       | Analytics, historical exploration |
| Custom/Trace-based      | State simulation, full trace analysis          | Research, MEV, governance         |

**Sources:**

- https://docs.envio.dev/blog/blog/best-blockchain-indexers-2026
- https://goldsky.com/products/mirror
- https://www.infoq.com/news/2023/10/goldsky-blockchain-streaming/
- https://www.redpanda.com/blog/democratize-streaming-data-web3-goldsky-redpanda
- https://ponder.sh/docs/migration-guide
- https://blog.ormilabs.com/best-blockchain-indexers-in-2025-real-time-web3-data-and-subgraph-platforms-compared/

---

## 3. Reorg Handling and Finality Strategies

### Reorg Frequency by Network

| Network          | Reorg Behavior                                          |
| ---------------- | ------------------------------------------------------- |
| Ethereum Mainnet | ~1% of blocks (~1 in 200 transactions)                  |
| Base / OP Stack  | Largely reorg-resistant (finality at head)              |
| Polygon          | Frequent deep reorgs (>10 blocks; one case: 157 blocks) |

### Detection Strategies

1. **Hash Chain Verification:** Each new block's parent hash must match the previous stored block hash. Sequential block numbers must increase. If either fails, reorg detected -- rewind to fork point.

2. **`removed: true` Flag:** WebSocket subscriptions push logs with `removed: true` for reorged events. Must handle these in the ingestion pipeline.

3. **Secondary Reorg Check (Tatum pattern):** Primary system tracks chain tip in near-real-time. A secondary mechanism runs on interval a few blocks behind tip to identify altered transactions, reprocessed with `reorg: true` flag.

### Handling Patterns

| Strategy                         | Description                                                      | Tradeoff                               |
| -------------------------------- | ---------------------------------------------------------------- | -------------------------------------- |
| **Stateless revert-and-replay**  | Delete entities from orphaned blocks, re-ingest canonical data   | Simple; works for append-only data     |
| **Delayed indexing**             | Wait N confirmations before indexing                             | Higher latency; fewer reorgs to handle |
| **Cursor/checkpoint tracking**   | Persist last confirmed block; rewind on reorg                    | Standard for production systems        |
| **Extract Once, Transform Many** | Push reverts + new blocks to Kafka; downstream transforms handle | Decouples extraction from processing   |

### AWS Reference Architecture (Reth ExEx Pattern)

```
Reth Node (ExEx) ──> Kafka (reverts + commits in order) ──> Flink/Transform ──> RDS/Data Sink
     ^                                                           |
     └── Backfill (parallel, no reorg concern) ──────────────────┘
```

### Finality Models

- **Probabilistic (PoW-style):** Reversal chance shrinks with depth but never reaches zero
- **Checkpoint-based (Casper FFG):** After 2/3 attestations justify a checkpoint, and a subsequent checkpoint justifies it again, the original is **finalized** -- reversion requires extraordinary faults + slashing

**Sources:**

- https://medium.com/@envio_indexer/indexing-reorgs-326f7b6b13ba
- https://www.quicknode.com/docs/streams/reorg-handling
- https://platform.chainbase.com/blog/article/unraveling-reorgs-problems-the-chainbase-approach
- https://aws.amazon.com/blogs/web3/building-a-blockchain-indexer-on-aws/
- https://docs.tatum.io/docs/handling-re-orgs

---

## 4. Cross-Chain Message Monitoring

### Platform Architectures

#### WormholeScan

- **Scale:** 1B+ messages transferred, ~$42.39B total volume
- **Core:** Tracks Verifiable Action Approvals (VAAs) across chains
- **Features:** Governor Dashboard (security/rate-limiting), VAA Parser tool, protocol integration
- **Architecture:** Guardian network (decentralized PoS validators) monitors Gateway contracts on all connected chains. Validators sign attestations; consensus reached after sufficient attestations.

#### LayerZero Scan

- **Message Lifecycle States:**
  - `Delivered` -- successfully received on destination
  - `Inflight` -- waiting for source confirmations, verification, or execution
  - `Payload Stored` -- arrived but reverted/out-of-gas on destination (needs retry)
  - `Failed` -- transaction error
  - `Blocked` -- previous nonce has stored payload
  - `Confirming` -- destination tx submitted, waiting for finality
- **Architecture:** Ultra-Light Nodes (ULN) accept off-chain evidence: block header from oracle + transaction proof from relayer
- **Verification:** Oracle-relayer model for near-instant delivery

#### Axelarscan

- **First tool** for complete cross-chain transaction state tracing
- **Tracking:** deposit confirmation -> batch signature -> gateway sending
- **Filtering:** by source chain, destination chain, token, status
- **Architecture:** Gateway Contracts on each chain + decentralized PoS validator set that monitors gateways and signs attestations

#### Chainlink CCIP Explorer

- **Security:** Modular framework with multiple decentralized node operators, separation of responsibilities, risk management network
- **Safety features:** Rate limiting, anomaly detection, circuit breakers that halt transfers on suspicious activity
- **Focus:** Enterprise/institutional use cases

### Common Cross-Chain Monitoring Patterns

1. **State machine per message:** Track lifecycle from source emission through verification to destination execution
2. **Multi-chain event correlation:** Match source chain events with destination chain events by message ID
3. **Timeout/retry tracking:** Monitor for stuck messages (stored payloads, failed executions)
4. **Guardian/validator attestation monitoring:** Track consensus progress for each message

**Sources:**

- https://wormholescan.io/
- https://wormhole.com/blog/wormholescan-upgrade-real-time-data-analytics-for-the-wormhole-ecosystem
- https://docs.layerzero.network/v2/developers/evm/tooling/layerzeroscan
- https://axelarscan.io/
- https://docs.chain.link/ccip/tools-resources/ccip-explorer

---

## 5. Prometheus Metrics for Blockchain Infrastructure

### Pull vs Push: Pull Wins

Prometheus is pull-based by design. Advantages for blockchain infra:

- **Dead target detection:** If a node stops responding, Prometheus knows immediately
- **Centralized configuration:** Scrape interval changes happen in one place
- **Load distribution:** Prometheus evenly distributes scrape timing

**Pushgateway** is only recommended for ephemeral batch jobs (not related to specific machine/instance). For edge blockchain nodes, use **Prometheus Agent mode** with `remote_write` to forward metrics to Thanos or Grafana Mimir.

### Scrape Intervals

| Use Case                            | Interval |
| ----------------------------------- | -------- |
| Validator status, consensus metrics | 5-10s    |
| Block height, peer count, tx pool   | 15-30s   |
| Long-term trends, stable infra      | 60s+     |

### Cardinality Management (Critical for Blockchain)

**Never use as labels:**

- Transaction hashes
- Wallet/validator addresses
- Block hashes
- Request/trace IDs

**Safe labels:**

- `chain_id`, `network`, `node_role`, `instance`, `region`

**Guidelines:**

- Keep per-metric cardinality below 10
- If cardinality exceeds 100, investigate alternatives
- Use `metric_relabel_configs` to drop high-cardinality labels before TSDB ingestion
- Monitor cardinality trends proactively

### Scaling for Multi-Node Blockchain Deployments

- **`remote_write`:** Forward metrics to centralized backend (Thanos, Mimir, Cortex)
- **Agent mode:** No local storage; lightweight collection agent only
- **Kubernetes SD or file-based SD:** For dynamic blockchain node fleets
- **Horizontal scaling:** Multiple Prometheus instances with federated queries

### Blockchain-Specific Exporters

Available for: Ethereum (Geth/Prysm), Solana, Cosmos SDK chains, Stacks, and many others. Grafana Cloud maintains integration guides.

**Sources:**

- https://www.groundcover.com/learn/observability/prometheus-scraping
- https://prometheus.io/docs/practices/pushing/
- https://prometheus.io/docs/practices/instrumentation/
- https://www.cncf.io/blog/2025/07/22/prometheus-labels-understanding-and-best-practices/
- https://grafana.com/docs/grafana-cloud/send-data/metrics/metrics-prometheus/prometheus-config-examples/open-source-projects/blockchain/
- https://oneuptime.com/blog/post/2026-01-25-prometheus-metric-cardinality/view

---

## 6. Event-Driven Architecture for Blockchain Data (CQRS + Event Sourcing)

### Natural Fit with Blockchain

Blockchain data is inherently an append-only event log, making CQRS + Event Sourcing a natural architectural fit:

- **Write side (Commands):** Ingest blockchain events (logs, transactions, blocks)
- **Read side (Queries):** Materialized views/projections optimized for specific query patterns
- **Separation enables:** Independent scaling (reads typically 100:1 over writes)

### Backfill vs Real-Time: The Dual-Mode Pattern

This is the **standard architecture** across the industry:

**Backfill Mode (Historical):**

- Process all blocks from genesis (or start block) to current head
- Parallelizable -- no reorg concern for historical data
- Checkpoint progress for restart resilience
- Often uses optimized bulk data sources (HyperSync, Firehose) instead of RPC

**Live Mode (Forward-fill):**

- Sequential processing of new blocks at chain tip
- Must handle reorgs (detect, revert, replay)
- Typically switches automatically when backfill catches up

**Seamless Transition (Firehose Pattern):**

- Stream from historical storage initially
- Automatically switch to real-time when caught up
- Client doesn't need to manage the transition

### Multi-Worker Pattern (fystack/multichain-indexer)

Four cooperating workers:

1. **Live blocks** -- real-time chain tip tracking
2. **Gap backfill** -- fill any missed ranges
3. **Failed retries** -- reprocess failures
4. **Manual rescans** -- on-demand re-indexing

Features: Bloom filter matching for address lookups, NATS JetStream for downstream events, RPC failover, restart-safe with KV store persistence.

### Event Sourcing vs Blockchain

Key distinction: Event sourcing uses append-only logs but immutability is **not enforced** (it's a convention). Blockchain enforces immutability cryptographically. This means blockchain event sourcing gets immutability guarantees "for free" from the source chain.

### Practical Considerations

- Eventual consistency is inherent -- read models lag behind writes
- Schema evolution for projections is the hardest operational challenge
- CDC (Change Data Capture) can bridge traditional CRUD systems with event stream benefits
- Production examples: Slack (Kafka + Redis for billions of messages), Netflix (CQRS + polyglot persistence for 260M subscribers), Uber (Kafka + Flink with exactly-once semantics)

**Sources:**

- https://aws.amazon.com/blogs/web3/building-a-blockchain-indexer-on-aws/
- https://github.com/fystack/multichain-indexer
- https://dev.to/yasmine_ddec94f4d4/event-driven-architecture-event-sourcing-and-cqrs-how-they-work-together-1bp1
- https://www.growin.com/blog/event-driven-architecture-scale-systems-2025/
- https://microservices.io/patterns/data/event-sourcing.html

---

## 7. Alerting and Webhook Systems

### Platform Comparison

| Feature                | Alchemy (Notify)                 | QuickNode (QuickAlerts) | Tenderly                                                                              |
| ---------------------- | -------------------------------- | ----------------------- | ------------------------------------------------------------------------------------- |
| **Delivery guarantee** | At-least-once                    | Guaranteed delivery     | Not explicitly documented                                                             |
| **Retry logic**        | 6 retries (15s, 1m, 10m, 1h, 1d) | 3 retries on non-200    | Not documented                                                                        |
| **Reorg handling**     | Not documented                   | Built-in                | Not documented                                                                        |
| **Security**           | Signature verification           | HMAC + IP allowlisting  | Not detailed                                                                          |
| **Destinations**       | Webhooks                         | Webhooks                | Email, Slack, Discord, Telegram, PagerDuty, Webhooks                                  |
| **Chain support**      | All EVM                          | 130+ networks           | EVM-compatible                                                                        |
| **Alert types**        | Event-based                      | Event-based             | 12 trigger types (tx, events, function calls, balance/state changes, token transfers) |

### Best Practices for Webhook Delivery

1. **At-least-once delivery:** Expect duplicates; make handlers idempotent
2. **Escalating retry intervals:** Start short (15s), increase exponentially (up to 1 day)
3. **HMAC signature verification:** Cryptographically validate incoming payloads
4. **IP allowlisting:** Restrict webhook endpoints to known delivery IPs
5. **Reorg awareness:** Include `reorg: true` flags or send corrective events
6. **Idempotency keys:** Use message IDs to deduplicate on the consumer side

### Tenderly's Unique Approach

- 12 alert trigger types including state changes and balance changes (not just events)
- Native integrations with incident management (PagerDuty) and team channels
- Webhook destinations can trigger external APIs, off-chain services, or dapp UI updates
- Web3 Actions allow custom code execution on alert triggers

**Sources:**

- https://www.alchemy.com/webhooks
- https://www.quicknode.com/webhooks
- https://forum.quicknode.com/t/retry-logic-of-quickalert-webhooks/214
- https://tenderly.co/monitoring
- https://docs.tenderly.co/alerts/intro-to-alerts

---

## 8. Docker Compose Patterns for Blockchain Tooling

### Blockscout (Full-Featured Production Explorer)

**Default `docker-compose.yml` spins up 9 containers:**

1. PostgreSQL 14.x (port 7432)
2. Redis (latest)
3. Blockscout backend (API at `/api`)
4. Nginx reverse proxy (binds backend, frontend, microservices)
5. Blockscout frontend (at `http://localhost`)
6. 4-5 Rust microservices (stats service with separate Postgres DB, verification, etc.)

**Key patterns:**

- Pre-built backend images for fast startup (no compilation needed)
- Separate databases for core data vs. statistics
- Nginx as unified entrypoint routing to multiple services
- Environment variable configuration for chain-specific settings
- Supports hundreds of EVM chains and rollups

### Otterscan (Lightweight Local Explorer)

**Minimal architecture:**

- Single React frontend container
- Requires Erigon archive node (or Anvil for devnets)
- Configure via `ERIGON_URL` environment variable
- Can run as single `docker run` command or Docker Compose with `.env`

**Key advantage:** Privacy-first -- all queries hit your own node, no external API calls.

### Common Docker Compose Patterns for Blockchain Tools

1. **Service decomposition:** Separate containers for DB, API, frontend, workers, proxy
2. **Database isolation:** Separate DB instances for different data domains (core vs. stats)
3. **Reverse proxy:** Nginx or Traefik as unified entrypoint
4. **Health checks:** Readiness endpoints for dependent service orchestration
5. **Volume management:** Persistent volumes for blockchain data and database state
6. **Environment templating:** `.env` files for chain-specific configuration
7. **Optional services:** Use Docker Compose profiles for optional components (monitoring, stats)

**Sources:**

- https://docs.blockscout.com/setup/deployment/docker-compose-deployment
- https://github.com/blockscout/blockscout/blob/master/docker-compose/docker-compose.yml
- https://github.com/otterscan/otterscan
- https://docs.erigon.tech/fundamentals/otterscan

---

## 9. PostgreSQL vs SQLite for Blockchain Indexing

### When to Use Each

| Factor                  | SQLite                                 | PostgreSQL                                             |
| ----------------------- | -------------------------------------- | ------------------------------------------------------ |
| **Concurrency**         | Single-writer, file-level locks        | MVCC, 100+ concurrent writers                          |
| **Data size**           | Up to ~100GB practical                 | Hundreds of TB to PB                                   |
| **Deployment**          | Zero config, embedded                  | Server process, connection setup                       |
| **First query latency** | Near-zero                              | 50-100ms (network + connection)                        |
| **Complex queries**     | Basic                                  | Advanced optimizer, parallel processing                |
| **Indexing**            | Basic B-tree                           | B-tree, GIN, GiST, BRIN, partial, expression, covering |
| **Use case**            | Dev/prototyping, single-user, embedded | Production, multi-user, analytics                      |

### Blockchain-Specific Findings

CoinDesk Data's engineering team chose PostgreSQL after evaluating BigQuery, Snowflake, ClickHouse, and specialized blockchain databases:

- Blockchain data arrives in real-time bursts (every 12s for Ethereum, 400ms for Solana)
- PostgreSQL handles **1M+ sustained inserts/second** on proper hardware
- Normalization strategy requires efficient multi-table joins -- PostgreSQL's cost-based optimizer excels
- Normalized dataset sizes: Bitcoin ~254GB, Solana ~61TB

### Ponder's Approach (Hybrid)

- SQLite for development (`.ponder/sqlite/public.db`)
- PostgreSQL for production
- In-memory database during backfill for maximum speed
- Same in-memory DB continues for live indexing (50+ db ops/sec improvement)

### Connection Pooling for PostgreSQL

- Start with application-level pooling (e.g., node-postgres pool)
- Add **PgBouncer** when exceeding 100-200 database connections or pooling across multiple services
- Ponder supports full `node-postgres` poolConfig options

### Migration Strategy (SQLite -> PostgreSQL)

- Migrate early; difficulty increases with data volume and SQLite-specific code assumptions
- SQLite uses type affinity (strings in INTEGER columns) -- PostgreSQL's strict typing catches bugs
- Most sub-10GB migrations take less than a day
- Key PostgreSQL features post-migration: BRIN indexes for time-ordered blockchain data, table partitioning (v12+), partial indexes for filtered queries

### PostgreSQL Optimization for Blockchain Data

- **BRIN indexes:** Ideal for naturally-ordered blockchain data (block number, timestamp)
- **Table partitioning:** Partition by block range or time period for efficient pruning
- **Covering indexes:** Eliminate table access for common query patterns
- **Autovacuum tuning:** Critical for high-write blockchain ingestion workloads
- **Connection pooling:** Amortize connection setup cost across requests

**Sources:**

- https://data.coindesk.com/blogs/on-chain-series-viii-scaling-transaction-indexing-with-postgresql-and-hybrid-storage-architecture
- https://chat2db.ai/resources/blog/sqlite-vs-postgresql-choose
- https://render.com/articles/how-to-migrate-from-sqlite-to-postgresql
- https://ponder.sh/docs/migration-guide
- https://www.selecthub.com/relational-database-solutions/postgresql-vs-sqlite/

---

## Key Takeaways for Warplane Architecture

1. **Hybrid ingestion is mandatory:** WebSocket for real-time + eth_getLogs for catch-up/backfill. No single approach is sufficient.

2. **Dual-mode indexing is standard:** Every production indexer separates backfill (parallel, no reorg concern) from live (sequential, reorg-aware). The transition should be seamless.

3. **Reorg handling is chain-specific:** Ethereum needs moderate handling (~1% reorgs), Polygon needs aggressive handling (deep reorgs), OP Stack is nearly reorg-free. Design per-chain strategies.

4. **Cross-chain message tracking is a state machine:** Track message lifecycle from source emission through verification to destination execution. Correlate events across chains by message ID.

5. **Prometheus pull model is correct:** Use 15-30s scrape intervals for blockchain nodes. Never use tx hashes or addresses as labels. Use `remote_write` for multi-node deployments.

6. **PostgreSQL for production, SQLite for dev:** Follow Ponder's pattern. Use BRIN indexes for time-ordered data, table partitioning, and connection pooling via PgBouncer at scale.

7. **Goldsky's streaming architecture is the reference:** Redpanda (not Kafka) as message broker + data lake, Flink for transforms, Rust engine for performance. Control plane / data plane separation.

8. **Webhook delivery requires at-least-once semantics:** Idempotent handlers, HMAC verification, escalating retries, reorg-aware payloads.

9. **Docker Compose patterns:** Service decomposition (DB, API, frontend, workers, proxy), separate databases for different domains, Nginx as unified entrypoint, `.env` for chain config.
