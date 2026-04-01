# Trace Model

The trace model describes how Warplane represents chain health observations over time.

## Core Types

### ChainId

A branded identifier for a blockchain within the Avalanche network.

```typescript
interface ChainId {
  readonly blockchainId: string;
}
```

Created via the `chainId()` factory which validates the ID format.

### HealthStatus

Represents the observed health of a chain at a point in time.

```typescript
type HealthStatus = "healthy" | "degraded" | "down" | "unknown";
```

### ChainStatus

A timestamped health observation for a single chain.

```typescript
interface ChainStatus {
  readonly chain: ChainId;
  readonly health: HealthStatus;
  readonly blockHeight: bigint;
  readonly timestamp: Date;
}
```

### Subnet

Groups related chains under a subnet identity.

```typescript
interface Subnet {
  readonly subnetId: string;
  readonly name: string;
  readonly chains: ChainId[];
}
```

## Data Flow

1. **Ingest** polls Avalanche nodes and produces `ChainStatus` observations
2. **Storage** persists observations via `ChainStatusWriter`
3. **API** reads current state via `ChainStatusReader`
4. **Web/CLI** present the data to operators

## Current State (Milestone 1)

The ingest pipeline returns fixture data. Real RPC polling is planned for Milestone 2.

## Storage Interfaces

```typescript
interface ChainStatusReader {
  get(chain: ChainId): Promise<ChainStatus | undefined>;
}

interface ChainStatusWriter {
  put(status: ChainStatus): Promise<void>;
}

type ChainStatusStore = ChainStatusReader & ChainStatusWriter;
```

Concrete implementations (SQLite, Postgres) are deferred to M2.
