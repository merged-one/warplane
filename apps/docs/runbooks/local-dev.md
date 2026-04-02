# Local Development

## Prerequisites

- Node.js >= 20 (see `.nvmrc`)
- pnpm >= 10
- Go >= 1.22 (for the tmpnet harness)

## Setup

```bash
git clone <repo-url> && cd warplane
make bootstrap    # installs pnpm and Go dependencies
```

## Daily Workflow

```bash
make build        # build all packages
make test         # run all tests
make check        # lint + typecheck
pnpm dev          # start the API server in watch mode
```

## Useful Scripts

| Command          | What it does                        |
| ---------------- | ----------------------------------- |
| `pnpm dev`       | Start Fastify API in dev mode       |
| `pnpm demo:seed` | Run the seeded demo end-to-end      |
| `pnpm docs:dev`  | Start VitePress docs in dev mode    |
| `pnpm docs:llms` | Generate llms.txt and llms-full.txt |
| `pnpm ai:pack`   | Generate AI context bundle          |
| `pnpm mcp:docs`  | Start the docs MCP server           |

## Running Tests

```bash
pnpm test              # all vitest tests
pnpm test -- --watch   # watch mode
cd harness/tmpnet && go test ./...   # Go tests
```

## Docs Site

```bash
cd apps/docs && pnpm dev      # dev server with hot reload
cd apps/docs && pnpm build    # production build
```
