# Warplane -- Risk Register

| ID | Risk | Likelihood | Impact | Mitigation | Owner | Status |
|----|------|-----------|--------|------------|-------|--------|
| R1 | Avalanche RPC API changes break ingest pipeline | Medium | High | Pin RPC versions; abstract behind interface; fixture-first testing | unassigned | Open |
| R2 | tmpnet instability causes flaky e2e tests | High | Medium | Isolate e2e from CI gate initially; retry logic; fallback to fixture mode | unassigned | Open |
| R3 | pnpm + Go monorepo tooling complexity | Medium | Medium | Makefile abstracts common ops; document setup in CONTRIBUTING.md | unassigned | Mitigated |
| R4 | Scope creep beyond M1 MVP | Medium | High | Strict backlog discipline; work-items.yaml tracks scope; ADRs document decisions | unassigned | Mitigated |
| R5 | Single-contributor bus factor | High | High | Document decisions via ADRs; automate what can be automated; clear onboarding docs | unassigned | Open |
| R6 | No CI pipeline yet | High | Medium | M2 priority; local `make check` and `make test` serve as stopgap | unassigned | Open |
| R7 | Dist artifacts committed to repo | Low | Low | Add to .gitignore once CI builds artifacts; currently needed for demo | unassigned | Accepted |

## Review cadence

Reviewed at each milestone boundary. Update likelihood, impact, and status as the project evolves.

## Links

- [Roadmap](roadmap.md)
- [Work items](work-items.yaml)
- [Decision log](../decisions/README.md)
