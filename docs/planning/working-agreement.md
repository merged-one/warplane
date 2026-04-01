# Working Agreement

Rules and conventions for contributing to Warplane. See also [CONTRIBUTING.md](../../CONTRIBUTING.md).

## Coding standards

### TypeScript

- Strict mode (`"strict": true`) in all packages
- Use `readonly` for interface properties that shouldn't be mutated
- Prefer explicit return types on exported functions
- No `any` -- use `unknown` and narrow
- Imports use `node:` prefix for Node built-ins

### Go

- Follow standard Go conventions (`gofmt`, `go vet`)
- Test files use `_test.go` suffix
- Keep the harness focused: it wraps tmpnet, nothing else

### General

- No placeholder TODOs without a matching backlog entry
- Every package has a `description` in its `package.json`
- Prefer small, focused commits over large batches

## Branching and PRs

- `main` is the default branch; it should always build and pass tests
- Feature branches: `feat/short-description`
- Bug fixes: `fix/short-description`
- Tasks/chores: `chore/short-description`
- PRs require at least one approval before merge
- Squash-merge to keep history clean
- Delete branches after merge

## Commit messages

Imperative mood, concise: "Add chain polling", not "Added chain polling".

Format:
```
<type>: <short summary>

<optional body explaining why, not what>
```

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`

## Code review

- Review within 1 business day
- Focus on: correctness, security, clarity, test coverage
- Use "Request changes" sparingly -- prefer suggestions
- Approve if the code meets the quality bar, even if you'd write it differently

## Architecture decisions

- Non-trivial decisions get an ADR: `node scripts/new-adr.mjs "Title"`
- ADRs are reviewed like code (via PR)
- Accepted ADRs are binding until superseded

## Planning and tracking

- Work items tracked in `docs/planning/work-items.yaml`
- Status updated in `docs/planning/status.md` at each milestone boundary
- Risks reviewed in `docs/planning/risk-register.md`

## Quality bar

Before merging:

1. `make build` passes
2. `make test` passes
3. `make check` (lint + typecheck) passes
4. New code has tests
5. ADR created if architectural decision was made
6. PR template checklist is complete

## Links

- [CONTRIBUTING.md](../../CONTRIBUTING.md)
- [Roadmap](roadmap.md)
- [Risk register](risk-register.md)
- [ADR process](../decisions/README.md)
