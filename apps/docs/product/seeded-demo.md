# Seeded Demo

The seeded demo runs the full Warplane stack locally using deterministic golden fixtures — no AvalancheGo binaries required.

## Running the Demo

```bash
pnpm demo:seed
```

This script:

1. Installs dependencies (if needed)
2. Builds all TypeScript packages
3. Starts the API server with auto-seeded golden fixtures
4. Starts the web dashboard

## What You Get

| Service      | URL                                  | Description                            |
| ------------ | ------------------------------------ | -------------------------------------- |
| Dashboard    | `http://localhost:5173`              | Trace explorer and scenario overview   |
| API          | `http://localhost:3100`              | REST API for traces, chains, scenarios |
| Swagger UI   | `http://localhost:3100/docs`         | Interactive API documentation          |
| OpenAPI spec | `http://localhost:3100/openapi.json` | Machine-readable API schema            |

## Data Included

The demo seeds 8 deterministic Teleporter message traces across 5 scenarios:

| Scenario                      | Status         | Traces |
| ----------------------------- | -------------- | ------ |
| `basic_send_receive`          | success        | 2      |
| `add_fee`                     | success        | 1      |
| `specified_receipts`          | success        | 1      |
| `retry_failed_execution`      | retry_success  | 2      |
| `replay_or_duplicate_blocked` | replay_blocked | 2      |

## Switching to Full E2E Mode

For integration testing against a live Avalanche network, see `docs/runbooks/full-e2e.md` in the repository.
