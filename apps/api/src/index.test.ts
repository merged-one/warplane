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
