# Troubleshooting

Common issues and solutions for both seeded mode and full E2E mode.

## Seeded Demo Mode

### `pnpm demo:seed` fails to start

**Symptom**: Script exits before API is ready.

**Possible causes**:

| Issue                    | Fix                                                                            |
| ------------------------ | ------------------------------------------------------------------------------ |
| Port 3100 already in use | `lsof -i :3100` to find the process, kill it or set `PORT=3200 pnpm demo:seed` |
| Port 5173 already in use | Set `WEB_PORT=5174 pnpm demo:seed`                                             |
| Node version too old     | Check `.nvmrc` — requires Node >= 20. Run `nvm use`                            |
| pnpm not installed       | `npm install -g pnpm@latest`                                                   |
| Build failure            | Run `pnpm build` separately to see the full error                              |
| Missing dependencies     | Delete `node_modules` and run `pnpm install`                                   |

### API starts but returns empty data

**Symptom**: `/api/v1/traces` returns `[]`.

**Cause**: Demo mode seeding may have failed silently.

**Fix**:

```bash
# Manually seed the database
pnpm db:seed

# Or check if the database file exists
ls -la data/warplane.db
```

### Database errors

**Symptom**: `SQLITE_ERROR` or migration failures.

**Fix**:

```bash
# Remove the database and re-seed
rm -f data/warplane.db data/warplane.db-wal data/warplane.db-shm
pnpm db:seed
```

### CLI cannot connect to API

**Symptom**: `warplane doctor` reports API unreachable.

**Fix**:

```bash
# Verify the API is running
curl http://localhost:3100/healthz

# If using a non-default port
warplane --api-url http://localhost:3200 doctor
```

### Web dashboard shows loading spinner indefinitely

**Symptom**: Dashboard loads but data never appears.

**Cause**: API is not running or CORS issue.

**Fix**:

```bash
# Start the API first
pnpm dev

# Then start the web dashboard
pnpm dev:web
```

## Full E2E Mode

### `AVALANCHEGO_PATH not set`

**Fix**: Export the environment variable pointing to your built AvalancheGo binary:

```bash
export AVALANCHEGO_PATH=/path/to/avalanchego/build/avalanchego
export AVALANCHEGO_PLUGIN_DIR=/path/to/avalanchego/build/plugins
```

### `go test` shows 0 tests

**Cause**: The E2E suite is gated behind the `RUN_E2E` environment variable. Without it, only the smoke test runs.

**Fix**: This is expected behavior for compile checks. To run full E2E:

```bash
RUN_E2E=1 make e2e
```

### Timeout during network bootstrap

**Symptom**: Tests fail with a timeout error during `BeforeSuite`.

**Fix**: Increase the timeout:

```bash
cd harness/tmpnet
RUN_E2E=1 go test -v -timeout 20m ./...
```

### Port conflicts during tmpnet

**Cause**: tmpnet uses ephemeral ports, but stale processes from a previous run may hold ports.

**Fix**:

```bash
# Find and kill stale avalanchego processes
pkill -f avalanchego
```

### Golden fixture verification fails

**Symptom**: `make golden-verify` reports differences.

**Cause**: Golden fixtures in the repo are out of sync with the generator.

**Fix**:

```bash
make golden          # Regenerate fixtures
make golden-verify   # Should now pass
```

## Build and CI Issues

### TypeScript build fails

```bash
# Clean all build artifacts and rebuild
pnpm -r run clean
pnpm build
```

### ESLint or Prettier errors

```bash
# Auto-fix formatting
pnpm format

# Check lint issues
pnpm lint
```

### Docs site build fails

```bash
# Check for broken links or syntax errors
pnpm docs:build 2>&1 | head -50
```

### llms.txt generation check fails in CI

**Cause**: Generated files (`llms.txt`, `llms-full.txt`, `docs/ai/context-map.json`) are out of date.

**Fix**:

```bash
pnpm docs:llms
# Commit the updated files
```

## Getting Help

If none of the above resolves your issue:

1. Run `pnpm run repo:check` to get a full health report
2. Check the [GitHub issues](https://github.com/warplane/warplane/issues) for known problems
3. Open a new issue using the [bug report template](https://github.com/warplane/warplane/issues/new?template=bug.yml)
