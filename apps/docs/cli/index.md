# CLI Reference

The Warplane CLI (`@warplane/cli`) provides command-line management and monitoring of Avalanche L1s.

## Installation

The CLI is part of the monorepo. Build it with:

```bash
pnpm build
```

Run via the workspace:

```bash
pnpm --filter @warplane/cli run start
```

## Available Commands

| Command  | Description                | Status       |
| -------- | -------------------------- | ------------ |
| `ping`   | Basic connectivity check   | Available    |
| `status` | Show chain health overview | Planned (M2) |
| `deploy` | Trigger subnet deployment  | Planned (M3) |
| `logs`   | Stream chain logs          | Planned (M3) |
| `config` | Manage CLI configuration   | Planned (M3) |

See [Commands](/cli/commands) for details.
