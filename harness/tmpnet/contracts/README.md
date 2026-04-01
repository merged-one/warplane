# Test Receiver Contracts

Minimal Solidity contracts used by the Warplane E2E test harness for Teleporter
scenario testing.

## Contracts

### EchoReceiver.sol

Simple receiver that stores the last received message payload and emits a
`MessageReceived` event. Used in `basic_send_receive`, `add_fee`, and
`specified_receipts` scenarios.

### FailableReceiver.sol

Receiver with configurable gas consumption. Deploy with a high `gasToConsume`
value to trigger execution failures when `RequiredGasLimit` is too low.
Used in the `retry_failed_execution` scenario.

## Compilation

These contracts are compiled with `solc` (Solidity 0.8.20+) or via Foundry:

```bash
# With solc
solc --optimize --bin --abi contracts/EchoReceiver.sol -o contracts/out/
solc --optimize --bin --abi contracts/FailableReceiver.sol -o contracts/out/

# With Foundry
forge build --contracts contracts/
```

The E2E harness deploys these contracts programmatically using the compiled
bytecode via go-ethereum's `bind` package.

## Design Principles

- **Minimal**: smallest possible code to test the Teleporter lifecycle
- **No external deps**: no OpenZeppelin or other imports
- **Single responsibility**: each contract tests exactly one behavior
- **Well-documented**: clear NatSpec for every public function
