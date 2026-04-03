# Milestone 3 -- Detailed Staged Implementation Plan

**Policy Engine and Remediation Workflows**

| Field             | Value                                       |
| ----------------- | ------------------------------------------- |
| Status            | Not Started                                 |
| Target completion | November 15, 2026                           |
| Budget            | $35,000                                     |
| Author            | Generated from M2 architecture + work items |
| Last updated      | 2026-04-03                                  |

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Stage 1 -- Policy Domain Model & Storage (Weeks 1--2)](#stage-1----policy-domain-model--storage-weeks-12)
4. [Stage 2 -- Policy Evaluation Engine (Weeks 2--4)](#stage-2----policy-evaluation-engine-weeks-24)
5. [Stage 3 -- Audit Log & Operator Identity (Weeks 3--5)](#stage-3----audit-log--operator-identity-weeks-35)
6. [Stage 4 -- Remediation: Retry & Fee Top-Up (Weeks 4--6)](#stage-4----remediation-retry--fee-top-up-weeks-46)
7. [Stage 5 -- Circuit Breakers & Route Management (Weeks 5--7)](#stage-5----circuit-breakers--route-management-weeks-57)
8. [Stage 6 -- Policy & Remediation Dashboard (Weeks 6--8)](#stage-6----policy--remediation-dashboard-weeks-68)
9. [Stage 7 -- Environment Promotion & CLI (Weeks 7--9)](#stage-7----environment-promotion--cli-weeks-79)
10. [Stage 8 -- Team Roles, Permissions & Hardening (Weeks 9--11)](#stage-8----team-roles-permissions--hardening-weeks-911)
11. [Quality Gates](#quality-gates)
12. [Risk Mitigations](#risk-mitigations)
13. [Appendix A -- Policy Schema Reference](#appendix-a----policy-schema-reference)
14. [Appendix B -- Remediation Transaction Flows](#appendix-b----remediation-transaction-flows)

---

## Executive Summary

Milestone 3 transforms Warplane from a read-only observability tool into a true **interchain control plane** with declarative policy enforcement and one-click remediation workflows. This is the milestone that differentiates Warplane from every existing cross-chain explorer — no other tool in the ecosystem offers automated policy evaluation or operator-initiated remediation for Teleporter/ICM messages.

The plan is organized into 8 overlapping stages across 11 weeks (Sep 1 -- Nov 15, 2026), building on the M2 foundation of live ingestion, webhook delivery, and Docker deployment.

**Key architectural decisions:**

- **Declarative policy model** — policies are Zod-validated configuration objects stored in the database, not code. Operators define rules via API or CLI; the engine evaluates them against every state change from the M2 correlator pipeline.
- **On-chain remediation via viem** — retry and fee top-up actions construct and submit EVM transactions through the same viem RPC client used for ingestion. Pre-flight safety checks (replay protection, balance verification) run before every submission.
- **Audit-first design** — every operator action (policy change, remediation, circuit breaker toggle) is logged to an immutable audit table before execution. The audit log is the source of truth for compliance and post-incident review.
- **API-key authentication with RBAC** — two built-in roles (admin, viewer) gate access to destructive remediation endpoints. API keys are bcrypt-hashed; no plaintext secrets stored.
- **Environment-portable configuration** — policies and routes can be exported, diffed, and promoted across local → Fuji → mainnet environments via the CLI.

**M2 dependencies (must be complete before M3 execution):**

- Stage 6: Webhook alerting (alert delivery infrastructure)
- Stage 7: Docker Compose & Fuji deployment (deployment story)
- Stage 8: E2E testing harness (validation infrastructure)

---

## Architecture Overview

### Control Plane Data Flow

```
                  ┌─────────────────────────────────────────────┐
                  │            M2 Pipeline (existing)            │
                  │                                              │
                  │  RPC → Normalizer → Correlator → Storage     │
                  │            │                                  │
                  │            │ isStateChange=true               │
                  │            ▼                                  │
                  │  ┌─────────────────────┐                     │
                  │  │  Alert Evaluator    │ (M2-S6)             │
                  │  │  (webhook delivery) │                     │
                  │  └─────────┬───────────┘                     │
                  └────────────┼─────────────────────────────────┘
                               │
                  ┌────────────▼─────────────────────────────────┐
                  │            M3 Policy Layer (new)              │
                  │                                              │
                  │  ┌─────────────────────┐                     │
                  │  │  Policy Evaluator   │ ◀── PolicyStore     │
                  │  │  (per state change) │                     │
                  │  └──────┬──────────────┘                     │
                  │         │                                    │
                  │    ┌────▼────┐    ┌──────────────┐           │
                  │    │Violation│───▶│ Webhook +    │           │
                  │    │ Store   │    │ Dashboard    │           │
                  │    └────┬────┘    └──────────────┘           │
                  │         │                                    │
                  │    ┌────▼──────────────────────┐             │
                  │    │  Circuit Breaker Engine   │             │
                  │    │  (auto-trip on threshold) │             │
                  │    └───────────────────────────┘             │
                  │                                              │
                  │  ┌────────────────────────────────┐          │
                  │  │  Remediation Engine             │          │
                  │  │  ├── RetryExecutor              │          │
                  │  │  ├── FeeTopUpExecutor            │          │
                  │  │  └── ChannelManager              │          │
                  │  │      (pre-flight → tx → audit)  │          │
                  │  └────────────────────────────────┘          │
                  │                                              │
                  │  ┌──────────────┐  ┌─────────────────┐       │
                  │  │  Audit Log   │  │  RBAC Middleware │       │
                  │  │  (immutable) │  │  (API key auth)  │       │
                  │  └──────────────┘  └─────────────────┘       │
                  └──────────────────────────────────────────────┘
```

### Package Responsibilities

| Package             | M3 Additions                                                         |
| ------------------- | -------------------------------------------------------------------- |
| `@warplane/domain`  | Policy schemas (Zod), violation types, remediation action types      |
| `@warplane/storage` | Policy, violation, audit, circuit-breaker, API-key repos + migration |
| `@warplane/ingest`  | Policy evaluator hook in pipeline coordinator                        |
| `@warplane/cli`     | `retry`, `fee`, `channel`, `policy`, `promote` commands              |
| `@warplane/api`     | Policy CRUD, remediation endpoints, audit log, RBAC middleware       |
| `@warplane/web`     | Policy dashboard, violation timeline, remediation actions panel      |

---

## Stage 1 -- Policy Domain Model & Storage (Weeks 1--2)

**Work items:** WP-201 (allowed relayers), WP-202 (fee floors), WP-203 (retry windows, route allowlists)
**Priority:** P0 -- Critical path
**Dependencies:** M2 complete (domain model, storage layer, DatabaseAdapter)

### 1.1 Objective

Define the canonical policy schema as Zod types in `@warplane/domain`, create the storage migration for policy and violation tables, and implement the repository functions. This stage produces the foundational types that every subsequent stage depends on.

### 1.2 Technical Specification

#### 1.2.1 Policy Types (`packages/domain/src/policies.ts`)

```typescript
import { z } from "zod";

/** A route identifies a source→destination chain pair */
export const Route = z.object({
  sourceChainId: z.string(), // Avalanche blockchain ID (cb58)
  destinationChainId: z.string(),
});

/** Individual policy rule conditions */
export const AllowedRelayerCondition = z.object({
  type: z.literal("allowed_relayer"),
  allowedAddresses: z.array(z.string()).min(1), // EVM addresses
});

export const FeeFloorCondition = z.object({
  type: z.literal("fee_floor"),
  minFeeWei: z.string(), // BigInt as string for JSON serialization
  tokenAddress: z.string().optional(), // Defaults to native token
});

export const RetryWindowCondition = z.object({
  type: z.literal("retry_window"),
  maxPendingMs: z.number().positive(), // Alert if pending > this duration
});

export const RouteAllowlistCondition = z.object({
  type: z.literal("route_allowlist"),
  allowedRoutes: z.array(Route).min(1),
});

export const CircuitBreakerCondition = z.object({
  type: z.literal("circuit_breaker"),
  failureRateThreshold: z.number().min(0).max(1), // e.g., 0.5 = 50%
  consecutiveFailureThreshold: z.number().int().positive().optional(),
  windowMs: z.number().positive(), // Evaluation window
  cooldownMs: z.number().positive(), // Time before auto-reset
});

export const StakeBelowCondition = z.object({
  type: z.literal("stake_below"),
  threshold: z.number().min(0).max(100), // Percentage
  subnetId: z.string(),
});

export const PolicyCondition = z.discriminatedUnion("type", [
  AllowedRelayerCondition,
  FeeFloorCondition,
  RetryWindowCondition,
  RouteAllowlistCondition,
  CircuitBreakerCondition,
  StakeBelowCondition,
]);
export type PolicyCondition = z.infer<typeof PolicyCondition>;

export const PolicySeverity = z.enum(["info", "warning", "critical"]);

export const Policy = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  condition: PolicyCondition,
  routes: z.array(Route).optional(), // Applies to all routes if omitted
  severity: PolicySeverity.default("warning"),
  enabled: z.boolean().default(true),
  webhookDestinations: z.array(z.number()).optional(), // Webhook destination IDs
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Policy = z.infer<typeof Policy>;

export const InsertPolicy = Policy.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPolicy = z.infer<typeof InsertPolicy>;
```

#### 1.2.2 Violation Types (`packages/domain/src/violations.ts`)

```typescript
import { z } from "zod";

export const Violation = z.object({
  id: z.number(),
  policyId: z.string().uuid(),
  messageId: z.string().optional(), // For message-specific violations
  route: z
    .object({
      sourceChainId: z.string(),
      destinationChainId: z.string(),
    })
    .optional(),
  severity: z.enum(["info", "warning", "critical"]),
  details: z.record(z.unknown()), // Condition-specific details
  resolvedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
});
export type Violation = z.infer<typeof Violation>;
```

#### 1.2.3 Storage Migration (`packages/storage/src/migrations/004_policies.sql`)

```sql
-- Policy definitions
CREATE TABLE IF NOT EXISTS policies (
  id          TEXT PRIMARY KEY,  -- UUID
  name        TEXT NOT NULL,
  description TEXT,
  condition   TEXT NOT NULL,     -- JSON (PolicyCondition)
  routes      TEXT,              -- JSON array of routes (null = all routes)
  severity    TEXT NOT NULL DEFAULT 'warning'
              CHECK (severity IN ('info', 'warning', 'critical')),
  enabled     INTEGER NOT NULL DEFAULT 1,
  webhook_destinations TEXT,     -- JSON array of destination IDs
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_policies_enabled ON policies(enabled) WHERE enabled = 1;

-- Policy violations
CREATE TABLE IF NOT EXISTS violations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  policy_id   TEXT NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  message_id  TEXT,
  route_json  TEXT,              -- JSON {sourceChainId, destinationChainId}
  severity    TEXT NOT NULL,
  details     TEXT NOT NULL,     -- JSON
  resolved_at TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_violations_policy ON violations(policy_id);
CREATE INDEX idx_violations_message ON violations(message_id) WHERE message_id IS NOT NULL;
CREATE INDEX idx_violations_unresolved ON violations(created_at)
  WHERE resolved_at IS NULL;

-- Circuit breaker state
CREATE TABLE IF NOT EXISTS circuit_breakers (
  id          TEXT PRIMARY KEY,  -- Route key: "sourceChainId:destinationChainId"
  policy_id   TEXT NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  state       TEXT NOT NULL DEFAULT 'closed'
              CHECK (state IN ('closed', 'open', 'half_open')),
  failure_count INTEGER NOT NULL DEFAULT 0,
  last_failure_at TEXT,
  opened_at   TEXT,
  cooldown_until TEXT,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

#### 1.2.4 Policy Repository (`packages/storage/src/repos/policies.ts`)

```typescript
// Async functions using DatabaseAdapter (same pattern as webhooks.ts)

insertPolicy(db, policy: InsertPolicy): Promise<string>       // Returns UUID
getPolicy(db, id: string): Promise<Policy | undefined>
listPolicies(db, opts?: { enabled?: boolean; type?: string }): Promise<Policy[]>
updatePolicy(db, id: string, updates: Partial<InsertPolicy>): Promise<void>
deletePolicy(db, id: string): Promise<void>

insertViolation(db, violation): Promise<number>                // Returns ID
listViolations(db, opts?: { policyId?: string; messageId?: string;
  unresolved?: boolean; since?: string; limit?: number }): Promise<Violation[]>
resolveViolation(db, id: number): Promise<void>

getCircuitBreakerState(db, routeKey: string): Promise<CircuitBreakerState | undefined>
upsertCircuitBreakerState(db, state: CircuitBreakerState): Promise<void>
listCircuitBreakers(db): Promise<CircuitBreakerState[]>
```

### 1.3 Acceptance Criteria

- [ ] Policy Zod schemas validate all 6 condition types
- [ ] Migration creates `policies`, `violations`, and `circuit_breakers` tables
- [ ] Policy CRUD repo functions pass 12+ unit tests
- [ ] Violation insert/list/resolve pass 6+ unit tests
- [ ] Circuit breaker state CRUD passes 4+ unit tests
- [ ] All types exported from `@warplane/domain` and `@warplane/storage`

### 1.4 Test Plan

| Test                                        | Type | Description                                             |
| ------------------------------------------- | ---- | ------------------------------------------------------- |
| Policy schema validates all condition types | Unit | Parse valid policies for each of 6 condition types      |
| Policy schema rejects invalid conditions    | Unit | Verify discriminated union rejects bad data             |
| Policy CRUD lifecycle                       | Unit | Insert → get → update → list → delete                   |
| Violation insert and query                  | Unit | Insert violations with/without messageId, query filters |
| Circuit breaker upsert and state changes    | Unit | Closed → open → half_open state transitions             |
| Policy cascade delete                       | Unit | Deleting a policy cascades to violations                |

### 1.5 Files

```
packages/domain/src/
  policies.ts                   # Policy and condition Zod schemas
  violations.ts                 # Violation types

packages/storage/src/
  migrations/004_policies.sql   # Policy, violation, circuit breaker tables
  repos/policies.ts             # Policy, violation, circuit breaker repos
  repos/policies.test.ts        # Unit tests
```

---

## Stage 2 -- Policy Evaluation Engine (Weeks 2--4)

**Work items:** WP-201, WP-202, WP-203
**Priority:** P0 -- Critical path
**Dependencies:** Stage 1 (policy types and storage)

### 2.1 Objective

Build the policy evaluation engine that hooks into the M2 pipeline correlator and checks every state change against active policies. When a violation is detected, it records the violation and dispatches alerts via the M2 webhook delivery system.

### 2.2 Technical Specification

#### 2.2.1 Policy Evaluator (`packages/ingest/src/policies/policy-evaluator.ts`)

```typescript
interface PolicyEvaluatorConfig {
  /** How often to reload policies from storage (default: 30000ms) */
  policyRefreshIntervalMs: number;
  /** How often to run the timeout scanner (default: 60000ms) */
  timeoutScanIntervalMs: number;
}

interface PolicyEvaluator {
  /** Called by pipeline coordinator on every state change */
  evaluate(result: CorrelationResult): Promise<EvaluationOutcome[]>;

  /** Periodic scan for timeout violations (pending messages exceeding retry_window) */
  scanTimeouts(): Promise<EvaluationOutcome[]>;

  /** Reload policies from storage */
  refreshPolicies(): Promise<void>;

  /** Shutdown and cleanup intervals */
  stop(): void;
}

interface EvaluationOutcome {
  policy: Policy;
  violation: boolean;
  details: Record<string, unknown>;
}
```

**Evaluation logic per condition type:**

| Condition         | Trigger                  | Evaluation                                             |
| ----------------- | ------------------------ | ------------------------------------------------------ |
| `allowed_relayer` | `relay_submitted` event  | Check `relayerAddress` against `allowedAddresses`      |
| `fee_floor`       | `message_sent` event     | Compare `feeInfo.amount` against `minFeeWei`           |
| `retry_window`    | Periodic scan            | Check `now - sendTime > maxPendingMs` for pending msgs |
| `route_allowlist` | `message_sent` event     | Verify route is in `allowedRoutes`                     |
| `circuit_breaker` | `execution_failed` event | Increment failure counter; trip if above threshold     |
| `stake_below`     | Sig-agg health snapshot  | Compare `connectedStake` against `threshold`           |

#### 2.2.2 Pipeline Integration (`packages/ingest/src/pipeline/coordinator.ts`)

Extend the existing pipeline coordinator to call the policy evaluator:

```typescript
// In processCorrelationResult():
if (result.isStateChange) {
  const outcomes = await this.policyEvaluator.evaluate(result);
  for (const outcome of outcomes) {
    if (outcome.violation) {
      await this.recordViolation(outcome);
      await this.dispatchViolationAlert(outcome);
    }
  }
}
```

### 2.3 Acceptance Criteria

- [ ] Allowed relayer policy detects unauthorized relayer addresses
- [ ] Fee floor policy detects underfunded messages
- [ ] Retry window scanner detects stale pending messages
- [ ] Route allowlist rejects messages on non-permitted routes
- [ ] Violations are recorded in the database with correct details
- [ ] Violations dispatch webhook alerts via M2 delivery engine
- [ ] Policy refresh loads updated policies without pipeline restart
- [ ] Policies scoped to specific routes only fire for matching routes
- [ ] Policies without route scope fire for all routes (global)

### 2.4 Test Plan

| Test                                       | Type        | Description                                             |
| ------------------------------------------ | ----------- | ------------------------------------------------------- |
| Allowed relayer — violation detected       | Unit        | Relay event with non-allowed address triggers violation |
| Allowed relayer — permitted relayer passes | Unit        | Relay event with allowed address passes                 |
| Fee floor — underfunded message            | Unit        | Message with fee below floor triggers violation         |
| Fee floor — adequately funded passes       | Unit        | Message with fee at/above floor passes                  |
| Retry window — stale message detected      | Unit        | Pending message older than window triggers violation    |
| Route allowlist — blocked route            | Unit        | Message on non-allowed route triggers violation         |
| Route-scoped policy — only fires on match  | Unit        | Policy scoped to route A ignores route B events         |
| Global policy — fires on all routes        | Unit        | Policy without route scope fires for any route          |
| Violation recorded to database             | Integration | Violation appears in storage after evaluation           |
| Webhook dispatched on violation            | Integration | Violation triggers webhook delivery enqueue             |
| Policy refresh picks up changes            | Unit        | Adding/disabling policy reflected in next evaluation    |

### 2.5 Files

```
packages/ingest/src/policies/
  policy-evaluator.ts           # Core evaluation engine
  policy-evaluator.test.ts      # Unit + integration tests
  evaluators/
    allowed-relayer.ts          # Allowed relayer condition evaluator
    fee-floor.ts                # Fee floor condition evaluator
    retry-window.ts             # Timeout scanner
    route-allowlist.ts          # Route allowlist evaluator
  index.ts                      # Exports
```

---

## Stage 3 -- Audit Log & Operator Identity (Weeks 3--5)

**Work items:** WP-209 (audit log)
**Priority:** P1
**Dependencies:** Stage 1 (storage layer)

### 3.1 Objective

Implement an immutable audit log that records every operator action — policy changes, remediation actions, circuit breaker toggles, and configuration changes. The audit log is the compliance backbone for M3 and a prerequisite for the remediation stages.

### 3.2 Technical Specification

#### 3.2.1 Audit Types (`packages/domain/src/audit.ts`)

```typescript
import { z } from "zod";

export const AuditAction = z.enum([
  // Policy actions
  "policy.created",
  "policy.updated",
  "policy.deleted",
  "policy.enabled",
  "policy.disabled",
  // Remediation actions
  "remediation.retry_initiated",
  "remediation.retry_succeeded",
  "remediation.retry_failed",
  "remediation.fee_topup_initiated",
  "remediation.fee_topup_succeeded",
  "remediation.fee_topup_failed",
  // Channel management
  "channel.paused",
  "channel.unpaused",
  // Circuit breaker actions
  "circuit_breaker.tripped",
  "circuit_breaker.reset",
  "circuit_breaker.manual_reset",
  // Auth actions
  "auth.api_key_created",
  "auth.api_key_revoked",
]);
export type AuditAction = z.infer<typeof AuditAction>;

export const AuditEntry = z.object({
  id: z.number(),
  timestamp: z.string().datetime(),
  actor: z.string(), // API key ID or "system"
  action: AuditAction,
  target: z.string(), // Resource ID (policy ID, message ID, route key)
  targetType: z.enum(["policy", "message", "route", "circuit_breaker", "api_key"]),
  details: z.record(z.unknown()).optional(),
  ipAddress: z.string().optional(),
});
export type AuditEntry = z.infer<typeof AuditEntry>;
```

#### 3.2.2 Audit Migration (`packages/storage/src/migrations/004_policies.sql` addition)

```sql
-- Audit log (append-only)
CREATE TABLE IF NOT EXISTS audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp   TEXT NOT NULL DEFAULT (datetime('now')),
  actor       TEXT NOT NULL,    -- API key ID or 'system'
  action      TEXT NOT NULL,    -- AuditAction enum value
  target      TEXT NOT NULL,    -- Resource identifier
  target_type TEXT NOT NULL,    -- 'policy', 'message', 'route', etc.
  details     TEXT,             -- JSON
  ip_address  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_target ON audit_log(target);
CREATE INDEX idx_audit_log_timestamp ON audit_log(timestamp);
CREATE INDEX idx_audit_log_actor ON audit_log(actor);
```

#### 3.2.3 Audit Repository (`packages/storage/src/repos/audit.ts`)

```typescript
insertAuditEntry(db, entry: InsertAuditEntry): Promise<number>
listAuditEntries(db, opts?: {
  action?: AuditAction;
  actor?: string;
  target?: string;
  targetType?: string;
  since?: string;
  until?: string;
  limit?: number;
  offset?: number;
}): Promise<AuditEntry[]>
countAuditEntries(db, opts?): Promise<number>
```

#### 3.2.4 API Endpoints

```
GET /api/v1/audit                     # List audit entries (paginated, filterable)
GET /api/v1/audit/actions             # List distinct actions (for filter dropdowns)
```

### 3.3 Acceptance Criteria

- [ ] Audit log table created with correct indexes
- [ ] All audit action types validated by Zod enum
- [ ] Audit entries are append-only (no UPDATE or DELETE operations)
- [ ] Audit log queryable by action, actor, target, time range
- [ ] Audit API endpoints return paginated, filtered results
- [ ] Audit entries include IP address when available from request

### 3.4 Test Plan

| Test                             | Type | Description                                           |
| -------------------------------- | ---- | ----------------------------------------------------- |
| Insert and retrieve audit entry  | Unit | Insert entry, verify all fields persist               |
| Filter by action type            | Unit | Query for specific action returns correct entries     |
| Filter by time range             | Unit | `since` and `until` filter correctly                  |
| Filter by actor                  | Unit | System vs. API key actor filtering                    |
| Pagination with offset and limit | Unit | Verify correct page of results returned               |
| Count entries matches list       | Unit | `countAuditEntries` matches `listAuditEntries` length |

### 3.5 Files

```
packages/domain/src/
  audit.ts                            # AuditAction, AuditEntry schemas

packages/storage/src/
  repos/audit.ts                      # Audit repo functions
  repos/audit.test.ts                 # Unit tests

apps/api/src/routes/
  audit.ts                            # GET /api/v1/audit endpoints
```

---

## Stage 4 -- Remediation: Retry & Fee Top-Up (Weeks 4--6)

**Work items:** WP-205 (retry initiation), WP-206 (fee top-up)
**Priority:** P0 (retry), P1 (fee top-up)
**Dependencies:** Stage 3 (audit log for action recording)

### 4.1 Objective

Implement the two core on-chain remediation workflows: **replay-safe retry** (calls `retryMessageExecution` on the destination chain) and **fee top-up** (calls `addFeeAmount` on the source chain). Both workflows include pre-flight safety checks, transaction submission via viem, and audit logging.

### 4.2 Technical Specification

#### 4.2.1 Remediation Types (`packages/domain/src/remediation.ts`)

```typescript
import { z } from "zod";

export const RetryRequest = z.object({
  messageId: z.string(),
  /** Optional gas limit override */
  gasLimit: z.string().optional(),
});

export const FeeTopUpRequest = z.object({
  messageId: z.string(),
  additionalFeeWei: z.string(), // BigInt as string
  feeTokenAddress: z.string().optional(), // Defaults to native token
});

export const RemediationResult = z.object({
  success: z.boolean(),
  action: z.enum(["retry", "fee_topup"]),
  messageId: z.string(),
  transactionHash: z.string().optional(),
  error: z.string().optional(),
  auditId: z.number(),
});
export type RemediationResult = z.infer<typeof RemediationResult>;
```

#### 4.2.2 Retry Executor (`packages/ingest/src/remediation/retry-executor.ts`)

```typescript
interface RetryExecutor {
  /**
   * Pre-flight checks:
   * 1. Message exists in storage
   * 2. Message status is 'failed' (execution_failed event present)
   * 3. Message is NOT replay_blocked
   * 4. Destination chain RPC is reachable
   * 5. Operator wallet has sufficient gas
   */
  preflight(messageId: string): Promise<PreflightResult>;

  /**
   * Execute retry:
   * 1. Record audit entry (remediation.retry_initiated)
   * 2. Construct retryMessageExecution transaction
   * 3. Submit via viem walletClient
   * 4. Wait for receipt
   * 5. Record outcome (remediation.retry_succeeded | remediation.retry_failed)
   */
  execute(request: RetryRequest, actor: string): Promise<RemediationResult>;
}

interface PreflightResult {
  ok: boolean;
  checks: {
    messageExists: boolean;
    statusIsFailed: boolean;
    notReplayBlocked: boolean;
    rpcReachable: boolean;
    sufficientGas: boolean;
  };
  message?: MessageTrace;
  errors: string[];
}
```

#### 4.2.3 Fee Top-Up Executor (`packages/ingest/src/remediation/fee-executor.ts`)

```typescript
interface FeeExecutor {
  /**
   * Pre-flight checks:
   * 1. Message exists in storage
   * 2. Source chain RPC is reachable
   * 3. Operator wallet has sufficient balance for fee amount
   * 4. Fee token is valid (native or ERC-20)
   */
  preflight(messageId: string): Promise<PreflightResult>;

  /**
   * Execute fee top-up:
   * 1. Record audit entry (remediation.fee_topup_initiated)
   * 2. Construct addFeeAmount transaction
   * 3. If ERC-20: check and submit approval if needed
   * 4. Submit via viem walletClient
   * 5. Wait for receipt
   * 6. Record outcome
   */
  execute(request: FeeTopUpRequest, actor: string): Promise<RemediationResult>;

  /**
   * Get current fee information for a message
   */
  getCurrentFee(messageId: string): Promise<{ amount: string; tokenAddress: string }>;
}
```

#### 4.2.4 API Endpoints

```
POST /api/v1/remediation/retry              # Initiate message retry
POST /api/v1/remediation/retry/preflight    # Dry-run preflight checks
POST /api/v1/remediation/fee-topup          # Initiate fee top-up
POST /api/v1/remediation/fee-topup/preflight # Dry-run preflight checks
GET  /api/v1/messages/:messageId/fee        # Current fee info
```

#### 4.2.5 CLI Commands

```bash
warplane retry <messageId> [--gas-limit <limit>] [--dry-run]
warplane fee topup <messageId> <amount> [--token <address>] [--dry-run]
warplane fee info <messageId>
```

### 4.3 Acceptance Criteria

- [ ] Retry pre-flight validates all 5 checks before execution
- [ ] Retry correctly calls `retryMessageExecution` on destination chain
- [ ] Fee top-up correctly calls `addFeeAmount` on source chain
- [ ] Both workflows record audit entries before and after execution
- [ ] `--dry-run` flag runs pre-flight only without submitting transaction
- [ ] API returns structured errors for each failed pre-flight check
- [ ] CLI commands output human-readable results and JSON with `--json`
- [ ] Replay protection prevents retry of already-delivered messages

### 4.4 Test Plan

| Test                                      | Type        | Description                               |
| ----------------------------------------- | ----------- | ----------------------------------------- |
| Retry preflight — message not found       | Unit        | Returns `messageExists: false`            |
| Retry preflight — message not failed      | Unit        | Returns `statusIsFailed: false`           |
| Retry preflight — replay blocked          | Unit        | Returns `notReplayBlocked: false`         |
| Retry preflight — all checks pass         | Unit        | Returns `ok: true` with all checks green  |
| Retry execute — success                   | Integration | Submits tx, records audit, returns hash   |
| Retry execute — tx reverts                | Integration | Records failure audit, returns error      |
| Fee preflight — all checks pass           | Unit        | Returns `ok: true`                        |
| Fee execute — native token top-up         | Integration | Submits addFeeAmount with native token    |
| Fee execute — ERC-20 top-up with approval | Integration | Submits approval then addFeeAmount        |
| Audit entries created for all actions     | Unit        | Both initiated and result entries present |

### 4.5 Files

```
packages/domain/src/
  remediation.ts                      # Retry/fee request and result schemas

packages/ingest/src/remediation/
  retry-executor.ts                   # Retry workflow
  fee-executor.ts                     # Fee top-up workflow
  preflight.ts                        # Shared pre-flight check utilities
  types.ts                            # Executor interfaces
  retry-executor.test.ts              # Tests
  fee-executor.test.ts                # Tests
  index.ts                            # Exports

packages/cli/src/commands/
  retry.ts                            # warplane retry command
  fee.ts                              # warplane fee command

apps/api/src/routes/
  remediation.ts                      # Retry and fee API endpoints
```

---

## Stage 5 -- Circuit Breakers & Route Management (Weeks 5--7)

**Work items:** WP-204 (circuit breakers), WP-207 (channel pause/unpause)
**Priority:** P1
**Dependencies:** Stage 2 (policy evaluator), Stage 3 (audit log)

### 5.1 Objective

Implement circuit breaker logic that automatically pauses alerting on routes experiencing sustained failures, and provide manual route pause/unpause controls for operators. Circuit breakers reduce alert fatigue during known incidents; route management gives operators explicit control over monitoring scope.

### 5.2 Technical Specification

#### 5.2.1 Circuit Breaker Engine (`packages/ingest/src/policies/circuit-breaker.ts`)

```typescript
interface CircuitBreakerEngine {
  /**
   * Called by policy evaluator on execution_failed events.
   * Increments failure counter; trips breaker if threshold exceeded.
   * State machine: closed → open → half_open → closed|open
   */
  recordFailure(routeKey: string, policyId: string): Promise<CircuitBreakerAction>;

  /**
   * Called by policy evaluator on successful delivery.
   * If in half_open state, resets to closed.
   */
  recordSuccess(routeKey: string): Promise<CircuitBreakerAction>;

  /**
   * Periodic check: auto-reset breakers past cooldown period.
   * Transitions open → half_open after cooldownMs.
   */
  checkCooldowns(): Promise<CircuitBreakerAction[]>;

  /**
   * Manual operator reset (via API/CLI).
   */
  manualReset(routeKey: string, actor: string): Promise<void>;
}

type CircuitBreakerAction =
  | { type: "noop" }
  | { type: "tripped"; routeKey: string; failureCount: number }
  | { type: "half_open"; routeKey: string }
  | { type: "reset"; routeKey: string };
```

#### 5.2.2 Route Management (`packages/ingest/src/policies/route-manager.ts`)

```typescript
interface RouteManager {
  /** Pause monitoring for a route — suppresses violations and alerts */
  pauseRoute(routeKey: string, actor: string, reason?: string): Promise<void>;

  /** Unpause monitoring for a route */
  unpauseRoute(routeKey: string, actor: string): Promise<void>;

  /** List all routes with their monitoring status */
  listRoutes(): Promise<RouteStatus[]>;

  /** Check if a route is paused (called before policy evaluation) */
  isPaused(routeKey: string): Promise<boolean>;
}

interface RouteStatus {
  sourceChainId: string;
  destinationChainId: string;
  paused: boolean;
  pausedAt?: string;
  pausedBy?: string;
  reason?: string;
  circuitBreaker?: CircuitBreakerState;
}
```

#### 5.2.3 API Endpoints

```
GET    /api/v1/routes                          # List routes with status
POST   /api/v1/routes/:routeKey/pause          # Pause route monitoring
POST   /api/v1/routes/:routeKey/unpause        # Unpause route monitoring

GET    /api/v1/circuit-breakers                # List all circuit breaker states
POST   /api/v1/circuit-breakers/:routeKey/reset # Manual reset
```

#### 5.2.4 CLI Commands

```bash
warplane channel list                          # List routes and status
warplane channel pause <sourceChain> <destChain> [--reason "..."]
warplane channel unpause <sourceChain> <destChain>
warplane circuit-breaker list
warplane circuit-breaker reset <sourceChain> <destChain>
```

### 5.3 Acceptance Criteria

- [ ] Circuit breaker trips when failure rate exceeds configured threshold
- [ ] Circuit breaker auto-resets after cooldown period (open → half_open)
- [ ] Successful delivery in half_open state resets to closed
- [ ] Manual reset transitions any state to closed with audit entry
- [ ] Route pause suppresses policy violations for that route
- [ ] Route unpause resumes policy evaluation with audit entry
- [ ] CLI commands provide human-readable and JSON output
- [ ] At least 4 total remediation flows across Stages 4-5 (retry, fee top-up, channel pause, circuit breaker reset)

### 5.4 Files

```
packages/ingest/src/policies/
  circuit-breaker.ts                  # Circuit breaker state machine
  circuit-breaker.test.ts             # Tests
  route-manager.ts                    # Route pause/unpause
  route-manager.test.ts               # Tests

packages/storage/src/
  repos/routes.ts                     # Route status repo
  repos/routes.test.ts                # Tests

packages/cli/src/commands/
  channel.ts                          # warplane channel command

apps/api/src/routes/
  routes-api.ts                       # Route management endpoints
  circuit-breakers.ts                 # Circuit breaker endpoints
```

---

## Stage 6 -- Policy & Remediation Dashboard (Weeks 6--8)

**Work items:** Part of WP-201 (dashboard visualization), WP-209 (audit visibility)
**Priority:** P1
**Dependencies:** Stage 2 (policy evaluator), Stage 3 (audit log), Stage 4 (remediation)

### 6.1 Objective

Extend the web dashboard with three new views: a **policy management page** for configuring and monitoring policies, a **violation timeline** showing recent policy violations with severity indicators, and a **remediation actions panel** providing one-click retry and fee top-up directly from the trace detail view. Also add audit log visibility.

### 6.2 Technical Specification

#### 6.2.1 Policy Management Page (`/policies`)

- **Policy list table:** Name, type, severity, routes, enabled status, violation count
- **Create/edit policy form:** Condition type selector → type-specific fields → route selector → save
- **Enable/disable toggle:** Inline switch with confirmation
- **Violation count badge:** Number of unresolved violations per policy

#### 6.2.2 Violation Timeline (`/violations`)

- **Timeline view:** Chronological list of recent violations
- **Severity color coding:** Critical (red), warning (orange), info (blue)
- **Filters:** Severity, policy type, route, time range, resolved/unresolved
- **Details expansion:** Click to expand violation details
- **Link to trace:** For message-specific violations, link to `/traces/:messageId`

#### 6.2.3 Trace Detail Enhancements (`/traces/:messageId`)

Add to existing trace detail page:

- **Remediation actions panel:** (visible only for failed/pending traces)
  - "Retry" button → pre-flight check → confirmation → execute
  - "Add Fee" button → current fee display → amount input → execute
  - Action result displayed inline
- **Violation indicators:** Any violations for this message shown in timeline

#### 6.2.4 Audit Log Page (`/audit`)

- **Paginated table:** Timestamp, actor, action, target, details
- **Filters:** Action type, actor, target type, time range
- **Auto-refresh:** Real-time updates when new entries appear

#### 6.2.5 Navigation Update

Add to `Layout.tsx` NAV_ITEMS:

- "Policies" → `/policies`
- "Audit" → `/audit`

### 6.3 Acceptance Criteria

- [ ] Policy list shows all configured policies with enable/disable controls
- [ ] Create policy form supports all 6 condition types
- [ ] Violation timeline displays with severity color coding
- [ ] Trace detail page shows remediation actions for failed messages
- [ ] Retry and fee top-up actions callable from dashboard
- [ ] Audit log page shows filterable, paginated action history
- [ ] All pages handle empty states (no policies, no violations, etc.)
- [ ] Responsive layout for 1024px+ screens

### 6.4 Files

```
apps/web/src/pages/
  PoliciesPage.tsx                    # Policy management
  ViolationsPage.tsx                  # Violation timeline
  AuditPage.tsx                       # Audit log viewer

apps/web/src/components/
  PolicyForm.tsx                      # Create/edit policy form
  ViolationBadge.tsx                  # Severity indicator
  RemediationPanel.tsx                # Retry/fee actions on trace detail

apps/web/src/api.ts                   # Add policy, violation, remediation, audit API types
apps/web/src/App.tsx                  # Add routes
apps/web/src/components/Layout.tsx    # Add nav items
apps/web/src/index.css                # Styles for new components
```

---

## Stage 7 -- Environment Promotion & CLI (Weeks 7--9)

**Work items:** WP-208 (environment promotion)
**Priority:** P1
**Dependencies:** Stage 1 (policy storage), Stage 5 (route management)

### 7.1 Objective

Enable operators to export, diff, and promote Warplane configurations (policies, routes, webhook destinations) across environments. An operator developing policies on a local instance can promote them to Fuji for testing, then to mainnet for production — with validation and diff review at each step.

### 7.2 Technical Specification

#### 7.2.1 Configuration Export Format

```typescript
interface WarplaneConfig {
  version: "1.0";
  environment: "local" | "fuji" | "mainnet" | string;
  exportedAt: string; // ISO 8601
  policies: Policy[];
  webhookDestinations: WebhookDestination[];
  routes: {
    pausedRoutes: Array<{
      sourceChainId: string;
      destinationChainId: string;
      reason?: string;
    }>;
  };
}
```

#### 7.2.2 CLI Commands

```bash
warplane config export [--env <name>] [--output <file>]
warplane config import <file> [--dry-run] [--force]
warplane config diff <file-a> <file-b>
warplane config promote <source-file> --target-env <fuji|mainnet>
```

**Promote workflow:**

1. Load source config and target environment config
2. Validate all chain IDs exist in target environment
3. Map contract addresses from source to target environment
4. Display diff for operator review
5. On confirmation, apply config to target via API

#### 7.2.3 Validation Rules

- Chain IDs referenced in policies must exist in the target environment's chain registry
- Contract addresses must be valid EVM addresses
- Webhook URLs must be reachable from the target environment
- Policies referencing non-existent routes emit warnings

### 7.3 Acceptance Criteria

- [ ] `config export` produces valid JSON matching the schema
- [ ] `config import` applies configuration with validation
- [ ] `--dry-run` flag previews changes without applying
- [ ] `config diff` shows human-readable differences between configs
- [ ] `config promote` validates chain IDs for target environment
- [ ] Import rejects configs with invalid chain IDs for the environment
- [ ] Round-trip: export → import produces identical config

### 7.4 Files

```
packages/domain/src/
  config.ts                           # WarplaneConfig schema

packages/cli/src/commands/
  config.ts                           # config export/import/diff/promote

packages/cli/src/commands/
  config.test.ts                      # Tests
```

---

## Stage 8 -- Team Roles, Permissions & Hardening (Weeks 9--11)

**Work items:** WP-210 (roles and permissions)
**Priority:** P2
**Dependencies:** Stage 3 (audit log), Stage 4 (remediation endpoints)

### 8.1 Objective

Add API key authentication with role-based access control (RBAC) to protect remediation endpoints. Two built-in roles — `admin` (full access) and `viewer` (read-only) — gate which operations each API key can perform. Also harden all M3 features with additional validation, error handling, and test coverage.

### 8.2 Technical Specification

#### 8.2.1 API Key Types

```typescript
interface ApiKey {
  id: string; // UUID
  name: string; // Human-readable label
  keyHash: string; // bcrypt hash of the key
  keyPrefix: string; // First 8 chars for identification (e.g., "wp_live_a1b2...")
  role: "admin" | "viewer";
  enabled: boolean;
  lastUsedAt?: string;
  createdAt: string;
}
```

#### 8.2.2 Auth Middleware (`apps/api/src/middleware/auth.ts`)

```typescript
/**
 * API key authentication middleware.
 * Reads X-API-Key header, validates against stored keys.
 * Attaches authenticated identity to request for audit logging.
 *
 * Routes can specify required role:
 *   app.post("/api/v1/remediation/retry", { preHandler: requireRole("admin") }, handler)
 */
```

**Authorization matrix:**

| Endpoint                     | Viewer | Admin |
| ---------------------------- | ------ | ----- |
| GET /api/v1/\*               | ✅     | ✅    |
| POST /api/v1/policies        | ❌     | ✅    |
| PUT/DELETE /api/v1/policies  | ❌     | ✅    |
| POST /api/v1/remediation/\*  | ❌     | ✅    |
| POST /api/v1/routes/\*/pause | ❌     | ✅    |
| GET /api/v1/audit            | ✅     | ✅    |

#### 8.2.3 Storage Migration

```sql
CREATE TABLE IF NOT EXISTS api_keys (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  key_hash    TEXT NOT NULL,
  key_prefix  TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('admin', 'viewer')),
  enabled     INTEGER NOT NULL DEFAULT 1,
  last_used_at TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

#### 8.2.4 CLI Commands

```bash
warplane auth create-key <name> --role <admin|viewer>
warplane auth list-keys
warplane auth revoke-key <key-id>
```

**Key creation outputs the raw key once (never stored):**

```
✓ API key created
  Name:   deploy-bot
  Role:   admin
  Key:    wp_live_a1b2c3d4e5f6g7h8i9j0...
  Prefix: wp_live_a1

⚠ Save this key now. It cannot be retrieved later.
```

### 8.3 Acceptance Criteria

- [ ] API keys are bcrypt-hashed (raw key never stored)
- [ ] Authentication middleware validates X-API-Key header
- [ ] Admin role has full access; viewer role is read-only
- [ ] Unauthenticated requests to protected endpoints return 401
- [ ] Viewer requests to admin endpoints return 403
- [ ] API key creation outputs raw key exactly once
- [ ] API key revocation immediately blocks further use
- [ ] All remediation endpoints require admin role
- [ ] Auth bypass available in development mode (env flag)
- [ ] Key usage tracked (lastUsedAt updated on each request)

### 8.4 Hardening Checklist

| Area             | Item                             | Description                                   |
| ---------------- | -------------------------------- | --------------------------------------------- |
| Input validation | Policy condition validation      | Reject malformed conditions at API boundary   |
| Input validation | Remediation request validation   | Verify message IDs, amounts, addresses        |
| Error handling   | Remediation transaction failures | Structured errors with chain-specific details |
| Error handling   | Policy evaluator resilience      | Single policy failure doesn't block others    |
| Rate limiting    | Remediation endpoints            | Max 10 remediation actions per minute per key |
| Rate limiting    | Policy creation                  | Max 100 policies per instance                 |
| Concurrency      | Duplicate retry prevention       | Prevent parallel retries for same message     |
| Observability    | Structured logging               | All M3 actions logged with structured fields  |
| Documentation    | API docs                         | OpenAPI schemas for all M3 endpoints          |

### 8.5 Files

```
apps/api/src/middleware/
  auth.ts                             # API key authentication + RBAC
  auth.test.ts                        # Auth middleware tests

packages/storage/src/
  repos/api-keys.ts                   # API key CRUD
  repos/api-keys.test.ts              # Tests

packages/cli/src/commands/
  auth.ts                             # API key management CLI

apps/api/src/routes/
  api-keys.ts                         # Key management endpoints (admin only)
```

---

## Quality Gates

### Per-Stage Gates

| Stage | Gate                                                               |
| ----- | ------------------------------------------------------------------ |
| 1     | 22+ unit tests pass; policy schemas validate all 6 types           |
| 2     | 11+ tests pass; policy evaluation detects all condition violations |
| 3     | 6+ tests pass; audit entries recorded for all action types         |
| 4     | 10+ tests pass; retry and fee top-up pre-flight + execution work   |
| 5     | 8+ tests pass; circuit breaker state machine + route pause/unpause |
| 6     | TypeScript compiles; all dashboard pages render with data          |
| 7     | Export → import round-trip produces identical config               |
| 8     | Auth middleware blocks unauthorized access; all M3 tests green     |

### Milestone Exit Criteria

- [ ] `pnpm test && pnpm typecheck && pnpm lint` all green
- [ ] At least **6 enforceable policies** shipped (allowed relayer, fee floor, retry window, route allowlist, circuit breaker, stake below)
- [ ] At least **4 one-click remediation flows** (retry, fee top-up, channel pause, circuit breaker reset)
- [ ] Mean time to diagnose simulated failed message **under 5 minutes**
- [ ] Audit log records **every operator action**
- [ ] All M3 API endpoints have OpenAPI schemas
- [ ] Documentation updated (runbooks, API docs, README)

---

## Risk Mitigations

| Risk                                          | Likelihood | Impact | Mitigation                                                            |
| --------------------------------------------- | ---------- | ------ | --------------------------------------------------------------------- |
| On-chain tx submission failures               | High       | High   | Extensive pre-flight checks; dry-run mode; audit trail for debugging  |
| Policy evaluation performance with many rules | Medium     | Medium | In-memory policy cache with periodic refresh; benchmark at 100 rules  |
| Circuit breaker thrashing                     | Medium     | Low    | Cooldown period; half_open state prevents rapid cycling               |
| Remediation key management complexity         | Medium     | Medium | Operator wallet is configured once; key rotation documented           |
| Scope creep into M4 features                  | Medium     | High   | Strict work item tracking; defer security hardening beyond basic RBAC |
| API key leakage                               | Low        | High   | bcrypt hashing; key shown once; prefix-only in logs/UI                |
| Cross-environment config drift                | Medium     | Medium | Config diff and validation at import time; promote workflow           |

---

## Appendix A -- Policy Schema Reference

### Condition Type Summary

| Type              | Trigger Event         | Parameters                    | Violation When                      |
| ----------------- | --------------------- | ----------------------------- | ----------------------------------- |
| `allowed_relayer` | `relay_submitted`     | `allowedAddresses: string[]`  | Relayer address not in allowed list |
| `fee_floor`       | `message_sent`        | `minFeeWei: string`           | Fee amount below configured floor   |
| `retry_window`    | Periodic scan         | `maxPendingMs: number`        | Pending duration exceeds window     |
| `route_allowlist` | `message_sent`        | `allowedRoutes: Route[]`      | Message route not in allowlist      |
| `circuit_breaker` | `execution_failed`    | `failureRateThreshold`, etc.  | Failure rate exceeds threshold      |
| `stake_below`     | Sig-agg health scrape | `threshold: number, subnetId` | Connected stake below percentage    |

### Policy Lifecycle

```
Created (disabled) → Enabled → Evaluating → Violation detected → Alert dispatched
                                    ↓
                            No violation → Continue monitoring
```

---

## Appendix B -- Remediation Transaction Flows

### Retry Flow

```
Operator → preflight(messageId) → Checks: exists? failed? not replayed? RPC up? gas?
         → audit(retry_initiated) → retryMessageExecution(destinationChainId, message)
         → waitForReceipt → audit(retry_succeeded | retry_failed)
```

### Fee Top-Up Flow

```
Operator → preflight(messageId) → Checks: exists? RPC up? balance?
         → audit(fee_topup_initiated) → [if ERC-20: approve()] → addFeeAmount(messageId, feeTokenAddress, amount)
         → waitForReceipt → audit(fee_topup_succeeded | fee_topup_failed)
```

### TeleporterMessenger Function Signatures

```solidity
function retryMessageExecution(
    bytes32 sourceBlockchainID,
    TeleporterMessage calldata message
) external;

function addFeeAmount(
    bytes32 messageID,
    address feeTokenAddress,
    uint256 additionalFeeAmount
) external;
```
