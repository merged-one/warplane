# Milestone 1 — Status

Last updated: 2026-04-01

## Summary

Milestone 1 delivers the monorepo skeleton, day-1 MVP code, and planning/governance system. All code deliverables are complete.

## Checklist

- [x] `pnpm install` / `pnpm build` / `pnpm test` all pass
- [x] `go test ./...` passes in `harness/tmpnet`
- [x] Typecheck passes (`tsc -b`)
- [x] Core domain types: ChainId, Subnet, HealthStatus, ChainStatus
- [x] Storage interfaces defined
- [x] Ingest pipeline stub
- [x] Fastify server with `/healthz` and `/api/v1/chains`
- [x] React + Vite dashboard shell
- [x] VitePress docs site
- [x] Go tmpnet harness with smoke test
- [x] CLI with `ping` command
- [x] Planning system (roadmap, work items, status, risk register)
- [x] ADR system with 3 accepted decisions
- [x] GitHub contribution flow (issue templates, PR template, labels)
- [x] Repo governance (CODEOWNERS, SECURITY, RELEASE, CONTRIBUTING)

## Deferred to M2+

See [Backlog](/planning/backlog).
