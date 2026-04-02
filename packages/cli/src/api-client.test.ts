/**
 * Unit tests for the API client.
 */

import { describe, expect, it, beforeAll, afterAll, beforeEach } from "vitest";
import http from "node:http";
import { ApiClient, ApiUnreachableError } from "./api-client.js";

// ---------------------------------------------------------------------------
// Test HTTP server
// ---------------------------------------------------------------------------

let server: http.Server;
let baseUrl: string;
let handler: (req: http.IncomingMessage, res: http.ServerResponse) => void;

beforeAll(async () => {
  server = http.createServer((req, res) => handler(req, res));
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const addr = server.address() as { port: number };
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

// Reset handler before each test
beforeEach(() => {
  handler = (_req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end("{}");
  };
});

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------

describe("ApiClient constructor", () => {
  it("uses default URL when no options given", () => {
    const saved = process.env["WARPLANE_API_URL"];
    delete process.env["WARPLANE_API_URL"];
    const client = new ApiClient();
    expect(client.baseUrl).toBe("http://localhost:3100");
    if (saved) process.env["WARPLANE_API_URL"] = saved;
  });

  it("uses WARPLANE_API_URL env var", () => {
    const saved = process.env["WARPLANE_API_URL"];
    process.env["WARPLANE_API_URL"] = "http://custom:9999";
    const client = new ApiClient();
    expect(client.baseUrl).toBe("http://custom:9999");
    if (saved) {
      process.env["WARPLANE_API_URL"] = saved;
    } else {
      delete process.env["WARPLANE_API_URL"];
    }
  });

  it("uses explicit baseUrl over env var", () => {
    const saved = process.env["WARPLANE_API_URL"];
    process.env["WARPLANE_API_URL"] = "http://env:1111";
    const client = new ApiClient({ baseUrl: "http://explicit:2222" });
    expect(client.baseUrl).toBe("http://explicit:2222");
    if (saved) {
      process.env["WARPLANE_API_URL"] = saved;
    } else {
      delete process.env["WARPLANE_API_URL"];
    }
  });

  it("strips trailing slash from baseUrl", () => {
    const client = new ApiClient({ baseUrl: "http://localhost:3100/" });
    expect(client.baseUrl).toBe("http://localhost:3100");
  });
});

// ---------------------------------------------------------------------------
// GET requests
// ---------------------------------------------------------------------------

describe("ApiClient.get", () => {
  it("makes a GET request and parses JSON", async () => {
    handler = (_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
    };
    const client = new ApiClient({ baseUrl });
    const data = await client.get<{ status: string }>("/health");
    expect(data.status).toBe("ok");
  });

  it("appends query parameters", async () => {
    let receivedUrl = "";
    handler = (req, res) => {
      receivedUrl = req.url ?? "";
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end("{}");
    };
    const client = new ApiClient({ baseUrl });
    await client.get("/api/v1/traces", { scenario: "test", status: "success", empty: undefined });
    expect(receivedUrl).toContain("scenario=test");
    expect(receivedUrl).toContain("status=success");
    expect(receivedUrl).not.toContain("empty");
  });

  it("converts numeric query params to strings", async () => {
    let receivedUrl = "";
    handler = (req, res) => {
      receivedUrl = req.url ?? "";
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end("{}");
    };
    const client = new ApiClient({ baseUrl });
    await client.get("/api/v1/traces", { pageSize: 5 });
    expect(receivedUrl).toContain("pageSize=5");
  });

  it("throws on non-2xx response", async () => {
    handler = (_req, res) => {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "not found" }));
    };
    const client = new ApiClient({ baseUrl });
    await expect(client.get("/api/v1/traces/missing")).rejects.toThrow("API 404");
  });

  it("includes response body in error message", async () => {
    handler = (_req, res) => {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "bad request" }));
    };
    const client = new ApiClient({ baseUrl });
    await expect(client.get("/bad")).rejects.toThrow("bad request");
  });
});

// ---------------------------------------------------------------------------
// POST requests
// ---------------------------------------------------------------------------

describe("ApiClient.post", () => {
  it("sends JSON body", async () => {
    let receivedBody = "";
    let receivedContentType = "";
    handler = (req, res) => {
      receivedContentType = req.headers["content-type"] ?? "";
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", () => {
        receivedBody = Buffer.concat(chunks).toString();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ importId: 1 }));
      });
    };
    const client = new ApiClient({ baseUrl });
    const result = await client.post<{ importId: number }>("/api/v1/import", {
      artifactsDir: "/tmp/test",
    });
    expect(result.importId).toBe(1);
    expect(receivedContentType).toBe("application/json");
    expect(JSON.parse(receivedBody)).toEqual({ artifactsDir: "/tmp/test" });
  });

  it("throws on non-2xx POST response", async () => {
    handler = (_req, res) => {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "server error" }));
    };
    const client = new ApiClient({ baseUrl });
    await expect(client.post("/api/v1/import", {})).rejects.toThrow("API 500");
  });
});

// ---------------------------------------------------------------------------
// ping
// ---------------------------------------------------------------------------

describe("ApiClient.ping", () => {
  it("returns health data on success", async () => {
    handler = (_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", traceCount: 9 }));
    };
    const client = new ApiClient({ baseUrl });
    const result = await client.ping();
    expect(result).toEqual({ status: "ok", traceCount: 9 });
  });

  it("returns null when API is unreachable", async () => {
    const client = new ApiClient({ baseUrl: "http://127.0.0.1:19999" });
    const result = await client.ping();
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Connection errors
// ---------------------------------------------------------------------------

describe("ApiUnreachableError", () => {
  it("is thrown when server is unreachable", async () => {
    const client = new ApiClient({ baseUrl: "http://127.0.0.1:19999" });
    await expect(client.get("/health")).rejects.toThrow(ApiUnreachableError);
  });

  it("contains helpful message with URL", async () => {
    const client = new ApiClient({ baseUrl: "http://127.0.0.1:19999" });
    try {
      await client.get("/health");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiUnreachableError);
      expect((err as Error).message).toContain("http://127.0.0.1:19999");
      expect((err as Error).message).toContain("pnpm dev");
    }
  });

  it("has name ApiUnreachableError", () => {
    const err = new ApiUnreachableError("http://localhost:3100");
    expect(err.name).toBe("ApiUnreachableError");
  });
});
