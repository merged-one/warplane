# Day-1 Demo

The Milestone 1 demo validates the monorepo skeleton end-to-end.

## Running the Demo

```bash
pnpm demo:day1
```

This script:

1. Builds all TypeScript packages (`pnpm build`)
2. Runs all tests (`pnpm test`)
3. Runs the Go harness smoke test (`cd harness/tmpnet && go test ./...`)
4. Prints a summary of all passing checks

## What It Proves

| Check        | Validates                                        |
| ------------ | ------------------------------------------------ |
| `pnpm build` | All packages compile, project references resolve |
| `pnpm test`  | Domain types, API endpoints are correct          |
| `go test`    | Go harness compiles and runs                     |

## Expected Output

A successful run prints pass status for each step. The demo uses fixture data only — no live Avalanche nodes are required.

## Next Steps

Real RPC polling and e2e tmpnet tests are planned for Milestone 2. See the [backlog](/planning/backlog).
