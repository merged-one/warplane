# Warplane tmpnet Test Harness

Go-based end-to-end test harness that spins up a local Avalanche network with
two L1 subnets and Teleporter pre-deployed using
[tmpnet](https://github.com/ava-labs/avalanchego/tree/master/tests/fixture/tmpnet).

## Structure

```
harness/tmpnet/
├── main.go                      # CLI entrypoint (smoke-check)
├── main_test.go                 # Smoke test (always runs)
├── teleporter_suite_test.go     # Ginkgo E2E suite (gated by RUN_E2E)
├── pkg/harness/
│   ├── types.go                 # L1TestInfo, NetworkInfo
│   ├── network.go               # CreateNetworkWithTeleporter helper
│   ├── artifacts.go             # Artifact directory management
│   ├── types_test.go            # Unit tests
│   └── artifacts_test.go        # Unit tests
└── artifacts/                   # Generated at runtime
    └── network/
        └── network.json         # Network metadata
```

## Quick Start

```bash
# Compile check (no Avalanche binaries needed)
make e2e-compile

# Run unit tests (always passes, E2E skipped)
cd harness/tmpnet && go test ./...

# Full E2E (requires AVALANCHEGO_PATH and AVALANCHEGO_PLUGIN_DIR)
make e2e
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `RUN_E2E` | For E2E | Set to any non-empty value to enable the Ginkgo suite |
| `AVALANCHEGO_PATH` | For E2E | Path to `avalanchego` binary |
| `AVALANCHEGO_PLUGIN_DIR` | For E2E | Path to plugin directory containing `subnet-evm` |
| `WARPLANE_ARTIFACTS_DIR` | Optional | Override default `artifacts/` directory |

## Design

- **Compile-safe**: `go test ./...` passes with `RUN_E2E` unset. The Ginkgo
  suite registers but all specs are skipped.
- **L1TestInfo**: Models everything a test needs for one Avalanche L1 — subnet
  ID, blockchain ID, EVM chain ID, node URIs, RPC/WS URLs, Teleporter address,
  and a funded key.
- **NetworkInfo**: Captures the full two-L1 topology and is serialised to
  `artifacts/network/network.json` for downstream tools.
- **Lifecycle**: `BeforeSuite` creates the network; `AfterSuite` tears it down.

See [docs/runbooks/full-e2e.md](../../docs/runbooks/full-e2e.md) for full
prerequisites and usage.
