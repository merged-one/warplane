# Milestone 1 — Status

## Monorepo skeleton

- [x] `pnpm install` works
- [x] `pnpm build` works
- [x] `pnpm test` works (3 tests, 2 files)
- [x] `go test ./...` works in `harness/tmpnet`
- [x] Typecheck passes (`tsc -b`)
- [x] README documents repo layout and M1 goal

## Domain model

- [x] Core types: ChainId, Subnet, HealthStatus, ChainStatus
- [x] Storage interfaces defined
- [x] Ingest pipeline stub

## API

- [x] Fastify server with `/healthz`
- [x] `/api/v1/chains` endpoint stub

## Web dashboard

- [x] React + Vite app shell

## Docs

- [x] VitePress site with intro page

## Harness

- [x] Go tmpnet module compiles and has smoke test

## CI / Scripts

- [x] `demo:day1` script
- [x] `docs:llms` script
- [x] `ai:pack` script
- [x] Makefile with bootstrap, build, test, check targets
