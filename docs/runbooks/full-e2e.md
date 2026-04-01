# Full E2E Testing with tmpnet

Run the Warplane integration test suite against a local Avalanche network with
two L1 subnets and Teleporter pre-deployed.

## Prerequisites

### 1. Go toolchain

Go 1.22+ is required. Verify with:

```bash
go version
```

### 2. Build AvalancheGo

```bash
git clone https://github.com/ava-labs/avalanchego.git
cd avalanchego
./scripts/build.sh
export AVALANCHEGO_PATH="$(pwd)/build/avalanchego"
export AVALANCHEGO_PLUGIN_DIR="$(pwd)/build/plugins"
```

### 3. Build subnet-evm plugin

```bash
git clone https://github.com/ava-labs/subnet-evm.git
cd subnet-evm
./scripts/build.sh "$AVALANCHEGO_PLUGIN_DIR/srEXiWaHuhNyGwPUi444Tu47ZEDwxTWrbQiuD7FmgSAQ6X7Dy"
```

The long hash is the VM ID for subnet-evm registered on the P-Chain.

### 4. (Optional) Teleporter contracts

If you need to deploy Teleporter contracts (required for cross-chain message
tests), clone and build the Teleporter deployer:

```bash
git clone https://github.com/ava-labs/teleporter.git
cd teleporter
# Follow the Teleporter repo build instructions
```

## Running

### Compile-only check (no binaries needed)

```bash
make e2e-compile
```

This verifies the harness Go code compiles and passes `go vet` without needing
any Avalanche binaries. It runs in CI and locally.

### Unit tests (no binaries needed)

```bash
cd harness/tmpnet && go test ./pkg/harness/ -v
```

Runs all unit tests for trace types, scenario helpers, and artifact I/O.

### Full E2E suite

```bash
# From repo root
make e2e

# Or manually:
cd harness/tmpnet
RUN_E2E=1 AVALANCHEGO_PATH=/path/to/avalanchego AVALANCHEGO_PLUGIN_DIR=/path/to/plugins \
  go test -v -timeout 10m ./...
```

### Filter by scenario

Run a single scenario using Ginkgo's `--focus` flag:

```bash
cd harness/tmpnet
RUN_E2E=1 ginkgo -v --timeout=10m --focus="basic_send_receive"
RUN_E2E=1 ginkgo -v --timeout=10m --focus="add_fee"
RUN_E2E=1 ginkgo -v --timeout=10m --focus="specified_receipts"
RUN_E2E=1 ginkgo -v --timeout=10m --focus="retry_failed_execution"
RUN_E2E=1 ginkgo -v --timeout=10m --focus="replay_or_duplicate_blocked"
```

## Scenarios

The E2E suite implements five deterministic Teleporter scenarios:

| Scenario | Description |
|----------|-------------|
| `basic_send_receive` | Send cross-chain message, aggregate signatures, relay, verify delivery |
| `add_fee` | Send with zero fee, call AddFeeAmount, verify fee_added event |
| `specified_receipts` | Send 3 messages A→B, relay, call SendSpecifiedReceipts B→A |
| `retry_failed_execution` | Send with low gas, verify execution failure, retry with enough gas |
| `replay_or_duplicate_blocked` | Deliver message, attempt duplicate, verify replay_blocked |

Each scenario produces:
- A `run.json` in `artifacts/scenarios/<name>/`
- One or more trace JSON files in `artifacts/traces/`

## Golden Fixtures

Deterministic golden trace artifacts can be generated without Avalanche binaries:

```bash
# Generate golden fixtures
make golden

# Verify current fixtures match regenerated output
make golden-verify
```

### Regenerating golden fixtures

```bash
cd harness/tmpnet
go run ./cmd/generate-golden --output-dir artifacts
```

Golden fixtures are committed to the repo and serve as:
- Regression tests for the trace schema
- Development fixtures for the API and CLI
- Documentation of expected Teleporter lifecycle events

## Artifacts

After a successful run, artifacts are written to:

```
harness/tmpnet/artifacts/
├── network/
│   └── network.json              # Network topology metadata
├── scenarios/
│   ├── basic_send_receive/
│   │   └── run.json              # Scenario execution metadata
│   ├── add_fee/
│   │   └── run.json
│   ├── specified_receipts/
│   │   └── run.json
│   ├── retry_failed_execution/
│   │   └── run.json
│   └── replay_or_duplicate_blocked/
│       └── run.json
└── traces/
    ├── index.json                # Consolidated trace index
    └── <messageId>.json          # Individual message traces
```

Override the directory with `WARPLANE_ARTIFACTS_DIR`:

```bash
WARPLANE_ARTIFACTS_DIR=/tmp/warplane-artifacts make e2e
```

### Trace JSON schema

Each trace file (`<messageId>.json`) contains:

| Field | Type | Description |
|-------|------|-------------|
| `messageId` | string | Deterministic SHA-256 message identifier |
| `scenario` | string | Scenario name |
| `source` | ChainMeta | Source chain identity |
| `destination` | ChainMeta | Destination chain identity |
| `sender` | string | Sender address |
| `recipient` | string | Recipient address |
| `sourceTxHash` | string | Transaction hash on source chain |
| `destinationTxHash` | string | Transaction hash on destination chain |
| `timestamps` | object | Send/receive times and block numbers |
| `events` | array | Normalized event timeline |
| `relayer` | object | Relayer address and tx hash |
| `fee` | object | Fee token, initial/added/total amounts |
| `execution` | string | Outcome: success, failed_execution, retry_success, replay_blocked |
| `retry` | object | Retry gas limits and tx hash |
| `rawRefs` | array | All referenced transaction hashes |

### Normalized event kinds

| Kind | Description |
|------|-------------|
| `message_sent` | Cross-chain message submitted on source |
| `warp_message_extracted` | Warp message extracted from receipt logs |
| `signatures_aggregated` | Quorum signatures collected |
| `relay_submitted` | Message relayed to destination chain |
| `delivery_confirmed` | MessageReceived == true on destination |
| `execution_failed` | Message delivered but execution reverted |
| `retry_requested` | RetryMessageExecution called |
| `retry_succeeded` | Execution succeeded on retry |
| `fee_added` | AddFeeAmount called |
| `receipts_sent` | SendSpecifiedReceipts called |
| `replay_blocked` | Duplicate/wrong-chain delivery rejected |

### Using Ginkgo CLI (optional)

For richer output and parallel runs, install the Ginkgo CLI:

```bash
go install github.com/onsi/ginkgo/v2/ginkgo@latest
cd harness/tmpnet
RUN_E2E=1 ginkgo -v --timeout=10m
```

## Receiver Contracts

Two minimal Solidity contracts are provided in `harness/tmpnet/contracts/`:

- **EchoReceiver.sol**: Stores last received payload, emits `MessageReceived`
- **FailableReceiver.sol**: Configurable gas consumption for retry testing

See `harness/tmpnet/contracts/README.md` for compilation instructions.

## Fallback: No Binaries Available

If you do not yet have AvalancheGo or plugin binaries locally:

1. **Compile check**: `make e2e-compile` verifies the harness compiles.
2. **Unit tests**: `cd harness/tmpnet && go test ./pkg/harness/` runs the
   unit tests for trace types and scenario helpers.
3. **Golden fixtures**: `make golden` generates deterministic trace artifacts
   without any Avalanche binaries.
4. **CI**: The CI pipeline will run the compile check on every PR. Full E2E is
   gated behind a separate CI job with pre-built binaries.

This ensures every developer can contribute to the harness without needing a
full Avalanche build environment.

## Troubleshooting

| Issue | Fix |
|---|---|
| `AVALANCHEGO_PATH not set` | Export the env var pointing to the built binary |
| `AVALANCHEGO_PLUGIN_DIR not set` | Export the env var pointing to the plugins dir |
| Timeout during network bootstrap | Increase `-timeout` (default 10m) |
| Port conflicts | tmpnet uses ephemeral ports; check for stale processes |
| `go test` shows 0 tests | RUN_E2E is not set — this is expected for compile checks |
| Golden verify fails | Run `make golden` to regenerate fixtures |

## Architecture

```
BeforeSuite
  ├── CreateNetworkWithTeleporter(ctx)
  │   ├── Bootstrap 5-node tmpnet
  │   ├── Create source L1 (subnet + blockchain)
  │   ├── Create destination L1 (subnet + blockchain)
  │   ├── Deploy TeleporterMessenger on both L1s
  │   └── Return NetworkInfo
  └── WriteNetworkInfo → artifacts/network/network.json

Scenarios (5 deterministic Teleporter tests)
  ├── basic_send_receive    → send, extract, aggregate, relay, verify
  ├── add_fee               → send, add fee, relay, verify fee event
  ├── specified_receipts    → send 3×, relay, send receipts B→A
  ├── retry_failed_execution → send, fail (low gas), retry, verify
  └── replay_or_duplicate   → send, deliver, duplicate → blocked

AfterSuite
  ├── WriteTraceIndex → artifacts/traces/index.json
  └── Network teardown + log collection
```
