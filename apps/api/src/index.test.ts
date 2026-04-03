import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { buildApp } from "./app.js";
import type { FastifyInstance } from "fastify";

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp({
    dbPath: ":memory:",
    demoMode: true,
    logger: false,
  });
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe("health", () => {
  it("GET /health returns ok with trace count", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe("ok");
    expect(body.traceCount).toBeGreaterThan(0);
    expect(typeof body.uptime).toBe("number");
  });

  it("GET /healthz returns ok (legacy)", async () => {
    const res = await app.inject({ method: "GET", url: "/healthz" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
  });
});

describe("GET /api/v1/network", () => {
  it("returns seeded networks", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/network" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.networks).toBeInstanceOf(Array);
    expect(body.networks.length).toBeGreaterThan(0);
    expect(body.networks[0]).toHaveProperty("networkId");
  });
});

describe("GET /api/v1/chains", () => {
  it("returns seeded chains", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/chains" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.chains).toBeInstanceOf(Array);
    expect(body.chains.length).toBeGreaterThan(0);
    expect(body.chains[0]).toHaveProperty("blockchainId");
  });
});

describe("GET /api/v1/scenarios", () => {
  it("returns seeded scenario runs", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/scenarios" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.scenarios).toBeInstanceOf(Array);
    expect(body.scenarios.length).toBeGreaterThan(0);
    expect(body.scenarios[0]).toHaveProperty("scenario");
    expect(body.scenarios[0]).toHaveProperty("passed");
  });
});

describe("GET /api/v1/traces", () => {
  it("returns all seeded traces", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/traces" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.traces).toBeInstanceOf(Array);
    expect(body.traces.length).toBeGreaterThan(0);
    expect(body.total).toBeGreaterThan(0);
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(50);
  });

  it("filters by scenario", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/traces?scenario=basic_send_receive",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    for (const t of body.traces) {
      expect(t.scenario).toBe("basic_send_receive");
    }
  });

  it("filters by execution status", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/traces?status=success",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    for (const t of body.traces) {
      expect(t.execution).toBe("success");
    }
  });

  it("supports pagination", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/traces?page=1&pageSize=2",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.traces.length).toBeLessThanOrEqual(2);
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(2);
  });
});

describe("GET /api/v1/traces/:messageId", () => {
  let firstMessageId: string;

  beforeAll(async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/traces?pageSize=1" });
    firstMessageId = res.json().traces[0].messageId;
  });

  it("returns a single trace by message ID", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/traces/${firstMessageId}`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.messageId).toBe(firstMessageId);
    expect(body.events).toBeInstanceOf(Array);
  });

  it("returns 404 for unknown message ID", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/traces/nonexistent-id",
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toHaveProperty("error");
  });
});

describe("GET /api/v1/traces/:messageId/timeline", () => {
  let firstMessageId: string;

  beforeAll(async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/traces?pageSize=1" });
    firstMessageId = res.json().traces[0].messageId;
  });

  it("returns ordered events", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/traces/${firstMessageId}/timeline`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.messageId).toBe(firstMessageId);
    expect(body.events).toBeInstanceOf(Array);
    expect(body.events.length).toBeGreaterThan(0);

    // Verify chronological ordering
    for (let i = 1; i < body.events.length; i++) {
      expect(body.events[i].timestamp >= body.events[i - 1].timestamp).toBe(true);
    }
  });

  it("returns 404 for unknown message ID", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/traces/nonexistent/timeline",
    });
    expect(res.statusCode).toBe(404);
  });
});

describe("GET /api/v1/traces/:messageId/raw", () => {
  let firstMessageId: string;

  beforeAll(async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/traces?pageSize=1" });
    firstMessageId = res.json().traces[0].messageId;
  });

  it("returns full raw trace", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/traces/${firstMessageId}/raw`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.messageId).toBe(firstMessageId);
    expect(body).toHaveProperty("source");
    expect(body).toHaveProperty("destination");
    expect(body).toHaveProperty("timestamps");
    expect(body).toHaveProperty("events");
  });
});

describe("GET /api/v1/failures", () => {
  it("returns non-success traces", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/failures" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.failures).toBeInstanceOf(Array);
    for (const t of body.failures) {
      expect(["failed", "replay_blocked", "pending"]).toContain(t.execution);
    }
  });
});

describe("GET /api/v1/search", () => {
  it("searches by scenario name", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/search?q=basic",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.query).toBe("basic");
    expect(body.traces.length).toBeGreaterThan(0);
  });

  it("requires a query parameter", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/search" });
    expect(res.statusCode).toBe(400);
  });
});

describe("POST /api/v1/import", () => {
  it("imports from the golden fixtures directory", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/import",
      payload: {
        artifactsDir: "harness/tmpnet/artifacts",
        sourceType: "test-import",
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.importId).toBeGreaterThan(0);
    expect(typeof body.traces).toBe("number");
  });

  it("returns 400 for missing directory", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/import",
      payload: { artifactsDir: "/nonexistent/path" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toHaveProperty("error");
  });
});

describe("GET /api/v1/imports", () => {
  it("returns import history", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/imports" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.imports).toBeInstanceOf(Array);
  });
});

// ---------------------------------------------------------------------------
// Relayer health endpoints
// ---------------------------------------------------------------------------

describe("GET /api/v1/relayer/health", () => {
  it("returns health array (may be empty in demo mode)", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/relayer/health" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.health).toBeInstanceOf(Array);
  });
});

describe("GET /api/v1/relayer/health/history", () => {
  it("returns history array with optional filtering", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/relayer/health/history?limit=10",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.history).toBeInstanceOf(Array);
  });
});

// ---------------------------------------------------------------------------
// Sig-agg health endpoints
// ---------------------------------------------------------------------------

describe("GET /api/v1/sigagg/health", () => {
  it("returns health object or null", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/sigagg/health" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("health");
  });
});

describe("GET /api/v1/sigagg/health/history", () => {
  it("returns history array", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/sigagg/health/history" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.history).toBeInstanceOf(Array);
  });
});

// ---------------------------------------------------------------------------
// Stats endpoints
// ---------------------------------------------------------------------------

describe("GET /api/v1/stats/failures", () => {
  it("returns failure classification array", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/stats/failures" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.failures).toBeInstanceOf(Array);
  });
});

describe("GET /api/v1/stats/latency", () => {
  it("returns p50, p90, p99 numbers and timeSeries", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/stats/latency" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(typeof body.p50).toBe("number");
    expect(typeof body.p90).toBe("number");
    expect(typeof body.p99).toBe("number");
    expect(body.timeSeries).toBeInstanceOf(Array);
  });
});

// ---------------------------------------------------------------------------
// Pipeline status endpoint
// ---------------------------------------------------------------------------

describe("GET /api/v1/pipeline/status", () => {
  it("returns pipeline status object", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/pipeline/status" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe("idle");
    expect(typeof body.traceCount).toBe("number");
    expect(typeof body.uptime).toBe("number");
  });

  it("returns complete schema with chains and stats when idle", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/pipeline/status" });
    const body = res.json();
    expect(body).toHaveProperty("chains");
    expect(body).toHaveProperty("stats");
    expect(Array.isArray(body.chains)).toBe(true);
    expect(body.chains.length).toBe(0); // No orchestrator = no chains
  });

  it("includes seeded trace count from database", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/pipeline/status" });
    const body = res.json();
    // Demo mode seeds 9 traces, so count should reflect DB state
    expect(body.traceCount).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Webhook endpoints
// ---------------------------------------------------------------------------

describe("POST /api/v1/webhooks", () => {
  it("creates a webhook destination and returns id", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/webhooks",
      payload: { name: "test-hook", url: "https://example.com/hook" },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(typeof body.id).toBe("number");
  });
});

describe("GET /api/v1/webhooks", () => {
  it("lists webhook destinations", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/webhooks" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.destinations).toBeInstanceOf(Array);
    expect(body.destinations.length).toBeGreaterThan(0);
  });
});

describe("PUT /api/v1/webhooks/:id", () => {
  it("updates a webhook destination", async () => {
    // Create one first
    const create = await app.inject({
      method: "POST",
      url: "/api/v1/webhooks",
      payload: { name: "update-me", url: "https://example.com/old" },
    });
    const { id } = create.json();

    const res = await app.inject({
      method: "PUT",
      url: `/api/v1/webhooks/${id}`,
      payload: { name: "updated-hook", url: "https://example.com/new" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
  });
});

describe("DELETE /api/v1/webhooks/:id", () => {
  it("deletes a webhook destination", async () => {
    const create = await app.inject({
      method: "POST",
      url: "/api/v1/webhooks",
      payload: { name: "delete-me", url: "https://example.com/gone" },
    });
    const { id } = create.json();

    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/webhooks/${id}`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
  });
});

describe("POST /api/v1/webhooks/:id/test", () => {
  it("returns test delivery result", async () => {
    const create = await app.inject({
      method: "POST",
      url: "/api/v1/webhooks",
      payload: { name: "test-dest", url: "https://example.com/test" },
    });
    const { id } = create.json();

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/webhooks/${id}/test`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(typeof body.success).toBe("boolean");
    // Will fail since example.com isn't reachable, but should not 500
  });
});

describe("GET /api/v1/webhooks/:id/deliveries", () => {
  it("returns delivery history for destination", async () => {
    const create = await app.inject({
      method: "POST",
      url: "/api/v1/webhooks",
      payload: { name: "delivery-hist", url: "https://example.com/hist" },
    });
    const { id } = create.json();

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/webhooks/${id}/deliveries`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.deliveries).toBeInstanceOf(Array);
  });
});

// ---------------------------------------------------------------------------
// Alert rule endpoints
// ---------------------------------------------------------------------------

describe("POST /api/v1/alerts/rules", () => {
  it("creates an alert rule and returns id", async () => {
    // Need a destination first
    const dest = await app.inject({
      method: "POST",
      url: "/api/v1/webhooks",
      payload: { name: "alert-dest", url: "https://example.com/alert" },
    });
    const destId = dest.json().id;

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/alerts/rules",
      payload: {
        name: "test-rule",
        condition: { type: "state_change", toState: "failed" },
        destinations: [destId],
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(typeof body.id).toBe("string");
  });
});

describe("GET /api/v1/alerts/rules", () => {
  it("lists alert rules", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/alerts/rules" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.rules).toBeInstanceOf(Array);
    expect(body.rules.length).toBeGreaterThan(0);
  });
});

describe("PUT /api/v1/alerts/rules/:id", () => {
  it("updates an alert rule", async () => {
    // Create destination + rule
    const dest = await app.inject({
      method: "POST",
      url: "/api/v1/webhooks",
      payload: { name: "upd-dest", url: "https://example.com/upd" },
    });
    const destId = dest.json().id;

    const create = await app.inject({
      method: "POST",
      url: "/api/v1/alerts/rules",
      payload: {
        name: "update-rule",
        condition: { type: "state_change", toState: "failed" },
        destinations: [destId],
      },
    });
    const { id } = create.json();

    const res = await app.inject({
      method: "PUT",
      url: `/api/v1/alerts/rules/${id}`,
      payload: { name: "updated-rule", enabled: false },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
  });
});

describe("DELETE /api/v1/alerts/rules/:id", () => {
  it("deletes an alert rule", async () => {
    const dest = await app.inject({
      method: "POST",
      url: "/api/v1/webhooks",
      payload: { name: "del-dest", url: "https://example.com/del" },
    });
    const destId = dest.json().id;

    const create = await app.inject({
      method: "POST",
      url: "/api/v1/alerts/rules",
      payload: {
        name: "delete-rule",
        condition: { type: "state_change", toState: "failed" },
        destinations: [destId],
      },
    });
    const { id } = create.json();

    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/alerts/rules/${id}`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// OpenAPI
// ---------------------------------------------------------------------------

describe("GET /openapi.json", () => {
  it("returns a valid OpenAPI spec", async () => {
    const res = await app.inject({ method: "GET", url: "/openapi.json" });
    expect(res.statusCode).toBe(200);
    const spec = res.json();
    expect(spec.openapi).toBe("3.1.0");
    expect(spec.info.title).toContain("Warplane");
    expect(spec.paths).toBeDefined();
  });
});
