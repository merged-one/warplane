import { describe, expect, it } from "vitest";
import Fastify from "fastify";

describe("api", () => {
  it("returns ok from /healthz", async () => {
    const app = Fastify();
    app.get("/healthz", async () => ({ status: "ok" }));
    const response = await app.inject({ method: "GET", url: "/healthz" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });
});
