# Domain Types

All domain types live in `packages/domain/src/index.ts`.

## ChainId

```typescript
interface ChainId {
  readonly blockchainId: string;
}

function chainId(blockchainId: string): ChainId;
```

The `chainId()` factory validates that the ID is a non-empty string. It serves as the primary identifier for chains throughout the system.

## Subnet

```typescript
interface Subnet {
  readonly subnetId: string;
  readonly name: string;
  readonly chains: ChainId[];
}
```

A subnet groups related chains. Each chain belongs to exactly one subnet in the Avalanche network.

## HealthStatus

```typescript
type HealthStatus = "healthy" | "degraded" | "down" | "unknown";
```

Four-state health model:
- **healthy**: Chain is responding normally
- **degraded**: Chain is responding but with issues (high latency, stale blocks)
- **down**: Chain is not responding
- **unknown**: No observation has been made yet

## ChainStatus

```typescript
interface ChainStatus {
  readonly chain: ChainId;
  readonly health: HealthStatus;
  readonly blockHeight: bigint;
  readonly timestamp: Date;
}
```

A point-in-time health observation. The `blockHeight` uses `bigint` to handle Avalanche's large block numbers without precision loss.

## Usage

```typescript
import { chainId, type ChainStatus, type HealthStatus } from "@warplane/domain";

const cChain = chainId("2q9e4r6Mu3U68nU1fYjgbR6JvwrRx36CohpAX5UQxse55x1Q5");

const status: ChainStatus = {
  chain: cChain,
  health: "healthy",
  blockHeight: 12345678n,
  timestamp: new Date(),
};
```
