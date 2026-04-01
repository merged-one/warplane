# API Endpoints

## GET /healthz

Health check endpoint.

**Response:**

```json
{ "status": "ok" }
```

**Status codes:**
- `200` — Server is healthy

## GET /api/v1/chains

Returns the list of registered chains and their status.

**Response (Milestone 1 — no chains registered):**

```json
{
  "chains": [],
  "message": "No chains registered yet"
}
```

**Response (future — with chain data):**

```json
{
  "chains": [
    {
      "chain": { "blockchainId": "2q9e4r..." },
      "health": "healthy",
      "blockHeight": "12345678",
      "timestamp": "2026-04-01T00:00:00.000Z"
    }
  ]
}
```

**Status codes:**
- `200` — Success

## Future Endpoints (M2+)

- `POST /api/v1/chains` — Register a chain for monitoring
- `GET /api/v1/chains/:id` — Get status for a specific chain
- `GET /api/v1/subnets` — List subnets
- `POST /api/v1/subnets/:id/deploy` — Trigger subnet deployment
