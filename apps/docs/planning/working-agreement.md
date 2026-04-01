# Working Agreement

Rules and conventions for contributing to Warplane.

## TypeScript Standards

- Strict mode in all packages
- `readonly` for interface properties that shouldn't be mutated
- Explicit return types on exported functions
- No `any` — use `unknown` and narrow
- `node:` prefix for Node built-in imports

## Go Standards

- Standard Go conventions (`gofmt`, `go vet`)
- Test files use `_test.go` suffix
- Harness wraps tmpnet only

## Branching

- `main` is the default branch; must always build and pass tests
- Feature: `feat/short-description`
- Bug fix: `fix/short-description`
- Chore: `chore/short-description`
- Squash-merge, delete branch after merge

## Commits

Imperative mood: "Add chain polling", not "Added chain polling".

Format: `<type>: <summary>` where type is `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, or `ci`.

## Quality Bar

1. `make build` passes
2. `make test` passes
3. `make check` (lint + typecheck) passes
4. New code has tests
5. ADR created for architectural decisions
6. PR template checklist complete

## Links

- [CONTRIBUTING.md](https://github.com/warplane)
- [ADR process](/decisions/)
