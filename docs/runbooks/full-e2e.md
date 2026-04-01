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

### Full E2E suite

```bash
# From repo root
make e2e

# Or manually:
cd harness/tmpnet
RUN_E2E=1 AVALANCHEGO_PATH=/path/to/avalanchego AVALANCHEGO_PLUGIN_DIR=/path/to/plugins \
  go test -v -timeout 10m ./...
```

### Artifacts

After a successful E2E run, network metadata is written to:

```
harness/tmpnet/artifacts/network/network.json
```

Override the directory with `WARPLANE_ARTIFACTS_DIR`:

```bash
WARPLANE_ARTIFACTS_DIR=/tmp/warplane-artifacts make e2e
```

### Using Ginkgo CLI (optional)

For richer output and parallel runs, install the Ginkgo CLI:

```bash
go install github.com/onsi/ginkgo/v2/ginkgo@latest
cd harness/tmpnet
RUN_E2E=1 ginkgo -v --timeout=10m
```

## Fallback: No Binaries Available

If you do not yet have AvalancheGo or plugin binaries locally:

1. **Compile check**: `make e2e-compile` verifies the harness compiles.
2. **Unit tests**: `cd harness/tmpnet && go test ./...` runs the `pkg/harness`
   unit tests and skips the E2E suite.
3. **CI**: The CI pipeline will run the compile check on every PR. Full E2E is
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

Specs
  ├── Teleporter send/receive tests
  └── Cross-chain message verification

AfterSuite
  └── Network teardown + log collection
```
