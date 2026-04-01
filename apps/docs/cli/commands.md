# CLI Commands

## ping

Basic connectivity check. Validates that the CLI is installed and can execute.

```bash
warplane ping
# Output: warplane pong
```

This command takes no arguments and always succeeds. It's used as a smoke test for the CLI build.

## Future Commands

### status (Milestone 2)

Show health overview of all monitored chains.

```bash
warplane status
warplane status --chain <chain-id>
```

### deploy (Milestone 3)

Trigger subnet deployment via the API.

```bash
warplane deploy --subnet <subnet-id> --config <path>
```

### logs (Milestone 3)

Stream chain logs from monitored nodes.

```bash
warplane logs --chain <chain-id> --follow
```

### config (Milestone 3)

Manage CLI configuration (API endpoint, credentials, defaults).

```bash
warplane config set api-url http://localhost:3000
warplane config get api-url
```
