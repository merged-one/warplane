# Warplane tmpnet Test Harness

Go-based end-to-end test harness that spins up a local Avalanche network with
two L1 subnets and Teleporter pre-deployed using
[tmpnet](https://github.com/ava-labs/avalanchego/tree/master/tests/fixture/tmpnet).

## Structure

```
harness/tmpnet/
├── main.go                          # CLI entrypoint (smoke-check)
├── main_test.go                     # Smoke test (always runs)
├── teleporter_suite_test.go         # Ginkgo E2E suite (gated by RUN_E2E)
├── teleporter_scenarios_test.go     # 5 deterministic Teleporter scenarios
├── cmd/generate-golden/
│   └── main.go                      # Golden fixture generator
├── contracts/
│   ├── EchoReceiver.sol             # Message echo receiver
│   ├── FailableReceiver.sol         # Configurable-gas receiver for retry tests
│   └── README.md
├── pkg/harness/
│   ├── types.go                     # L1TestInfo, NetworkInfo
│   ├── network.go                   # CreateNetworkWithTeleporter helper
│   ├── artifacts.go                 # Artifact directory management
│   ├── traces.go                    # Trace types, event kinds, artifact I/O
│   ├── scenarios.go                 # ScenarioContext with simulate helpers
│   ├── types_test.go
│   ├── artifacts_test.go
│   ├── traces_test.go
│   └── scenarios_test.go
└── artifacts/                       # Generated at runtime / golden fixtures
    ├── network/network.json
    ├── scenarios/<name>/run.json
    └── traces/<messageId>.json + index.json
```

## Quick Start

```bash
# Compile check (no Avalanche binaries needed)
make e2e-compile

# Run unit tests (always passes, E2E skipped)
cd harness/tmpnet && go test ./pkg/harness/ -v

# Generate golden trace fixtures (no binaries needed)
make golden

# Verify golden fixtures are reproducible
make golden-verify

# Full E2E (requires AVALANCHEGO_PATH and AVALANCHEGO_PLUGIN_DIR)
make e2e
```

## Scenarios

| Scenario | Events | Outcome |
|----------|--------|---------|
| `basic_send_receive` | send → extract → aggregate → relay → confirm | success |
| `add_fee` | send → add fee → extract → aggregate → relay → confirm | success |
| `specified_receipts` | send ×3 → relay ×3 → send receipts B→A | success |
| `retry_failed_execution` | send → fail (low gas) → retry → success | retry_success |
| `replay_or_duplicate_blocked` | send → deliver → duplicate → blocked | replay_blocked |

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
- **Deterministic traces**: The `ScenarioContext` produces stable message IDs,
  timestamps, and tx hashes from SHA-256 of scenario name + sequence number.
- **Golden fixtures**: `make golden` regenerates all trace artifacts without
  any Avalanche binaries. Committed artifacts serve as regression fixtures.
- **L1TestInfo**: Models everything a test needs for one Avalanche L1 — subnet
  ID, blockchain ID, EVM chain ID, node URIs, RPC/WS URLs, Teleporter address,
  and a funded key.
- **NetworkInfo**: Captures the full two-L1 topology and is serialised to
  `artifacts/network/network.json` for downstream tools.
- **Lifecycle**: `BeforeSuite` creates the network; `AfterSuite` writes the
  trace index and tears down the network.

See [docs/runbooks/full-e2e.md](../../docs/runbooks/full-e2e.md) for full
prerequisites and usage.
