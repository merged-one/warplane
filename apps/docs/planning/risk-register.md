# Risk Register

| ID  | Risk                                   | Likelihood | Impact | Mitigation                                                  | Status    |
| --- | -------------------------------------- | ---------- | ------ | ----------------------------------------------------------- | --------- |
| R1  | Avalanche RPC API changes break ingest | Medium     | High   | Pin versions, abstract behind interface, fixture-first      | Open      |
| R2  | tmpnet instability causes flaky e2e    | High       | Medium | Isolate e2e from CI gate, retry logic, fallback to fixtures | Open      |
| R3  | pnpm + Go monorepo complexity          | Medium     | Medium | Makefile abstracts ops, documented in CONTRIBUTING.md       | Mitigated |
| R4  | Scope creep beyond M1 MVP              | Medium     | High   | Strict backlog discipline, ADRs document decisions          | Mitigated |
| R5  | Single-contributor bus factor          | High       | High   | ADRs, automation, onboarding docs                           | Open      |
| R6  | No CI pipeline yet                     | High       | Medium | M2 priority, local `make check` as stopgap                  | Open      |
| R7  | Dist artifacts in repo                 | Low        | Low    | Will gitignore once CI builds artifacts                     | Accepted  |

## Review Cadence

Reviewed at each milestone boundary.
