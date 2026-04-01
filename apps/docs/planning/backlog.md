# Backlog — Deferred Items

Items recognized as needed but explicitly deferred from Milestone 1.

## Infrastructure

- **CI pipeline** (GitHub Actions): lint, test, build for Node + Go
- **Docker Compose**: local dev environment with API + web + database
- **e2e test wiring**: `make e2e` needs tmpnet integration

## Features

- **Real chain polling**: `@warplane/ingest` currently returns fixture data
- **Storage implementations**: needs SQLite/Postgres adapter
- **CLI commands beyond `ping`**: status, deploy, logs, config
- **Web dashboard data fetching**: needs API client and state management

## Quality

- ESLint CI enforcement
- Prettier format check in CI
- Test coverage thresholds
- Go linter (`golangci-lint`) integration
