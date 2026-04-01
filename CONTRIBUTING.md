# Contributing to Warplane

## Local setup

```bash
# Clone and bootstrap
git clone <repo-url> && cd warplane
make bootstrap
```

Requirements: Node >= 20, pnpm >= 10, Go >= 1.22.

## Quality bar

Before opening a PR:

1. **Build passes**: `pnpm build` and `cd harness/tmpnet && go build ./...`
2. **Tests pass**: `pnpm test` and `cd harness/tmpnet && go test ./...`
3. **Lint + typecheck pass**: `pnpm run check`
4. **No placeholder TODOs** without a matching entry in `docs/planning/backlog.md`
5. **Every package has a purpose** documented in its `package.json` description

## Monorepo conventions

- Packages use `workspace:*` protocol for internal dependencies.
- TypeScript packages use project references (`composite: true`).
- All TypeScript is strict mode.
- The root `vitest.config.ts` runs tests across packages and `apps/api`.
- The `apps/web` and `apps/docs` packages build with Vite/VitePress (no `tsc`).

## Commit style

Use concise, imperative commit messages: "Add chain polling", not "Added chain polling".
