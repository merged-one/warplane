# API Reference

The Warplane API is a Fastify server in `apps/api/`.

## Base URL

```
http://localhost:3000
```

Start the dev server:

```bash
pnpm dev
```

## Authentication

No authentication in Milestone 1. Auth is planned for a future milestone.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/healthz` | Health check |
| GET | `/api/v1/chains` | List chain statuses |

See [Endpoints](/api/endpoints) for full details.

## Response Format

All responses are JSON. The API follows standard HTTP status codes.
