import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { openDb, closeDb, type Database } from "@warplane/storage";
import { runMigrations, createSqliteAdapter } from "@warplane/storage";
import type { DatabaseAdapter } from "@warplane/storage";
import { insertWebhookDestination, getPendingDeliveries } from "@warplane/storage";
import { createDeliveryEngine, MAX_ATTEMPTS, computeSignature } from "./webhook-delivery.js";
import type { WebhookPayload } from "./types.js";

let rawDb: Database;
let db: DatabaseAdapter;

beforeEach(() => {
  rawDb = openDb({ path: ":memory:" });
  runMigrations(rawDb);
  db = createSqliteAdapter(rawDb);
});

afterEach(() => {
  closeDb(rawDb);
  vi.restoreAllMocks();
});

function makePayload(overrides?: Partial<WebhookPayload>): WebhookPayload {
  return {
    id: "delivery-001",
    timestamp: new Date().toISOString(),
    type: "state_change",
    messageId: "msg-001",
    data: { toState: "failed" },
    ...overrides,
  };
}

describe("WebhookDeliveryEngine", () => {
  it("enqueue creates a pending delivery in the database", async () => {
    const destId = await insertWebhookDestination(db, {
      name: "test-hook",
      url: "https://example.com/hook",
    });

    const engine = createDeliveryEngine(db);
    await engine.enqueue(destId, makePayload());

    const pending = await getPendingDeliveries(db);
    expect(pending).toHaveLength(1);
    expect(pending[0]!.destinationId).toBe(destId);
    expect(pending[0]!.status).toBe("pending");
    expect(pending[0]!.eventKind).toBe("state_change");
  });

  it("processQueue delivers to URL with correct payload", async () => {
    const destId = await insertWebhookDestination(db, {
      name: "test-hook",
      url: "https://example.com/hook",
      secret: "my-secret",
    });

    const engine = createDeliveryEngine(db);
    const payload = makePayload();
    await engine.enqueue(destId, payload);

    // Mock fetch to succeed
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("ok", { status: 200 }));

    const results = await engine.processQueue();
    expect(results).toHaveLength(1);
    expect(results[0]!.success).toBe(true);
    expect(results[0]!.statusCode).toBe(200);

    // Verify fetch was called with correct URL
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const call = fetchSpy.mock.calls[0]!;
    expect(call[0]).toBe("https://example.com/hook");
  });

  it("processQueue sets HMAC-SHA256 signature header when secret exists", async () => {
    const secret = "webhook-secret-123";
    const destId = await insertWebhookDestination(db, {
      name: "signed-hook",
      url: "https://example.com/hook",
      secret,
    });

    const engine = createDeliveryEngine(db);
    const payload = makePayload();
    await engine.enqueue(destId, payload);

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("ok", { status: 200 }));

    await engine.processQueue();

    const call = fetchSpy.mock.calls[0]!;
    const requestInit = call[1] as RequestInit;
    const headers = requestInit.headers as Record<string, string>;
    expect(headers["X-Warplane-Signature"]).toBeTruthy();

    // Verify the signature is correct
    const bodyJson = requestInit.body as string;
    const expectedSig = computeSignature(secret, bodyJson);
    expect(headers["X-Warplane-Signature"]).toBe(expectedSig);
  });

  it("failed delivery increments attempts and sets next_retry_at", async () => {
    const destId = await insertWebhookDestination(db, {
      name: "failing-hook",
      url: "https://example.com/hook",
    });

    const engine = createDeliveryEngine(db);
    await engine.enqueue(destId, makePayload());

    // Mock fetch to fail with 500
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("server error", { status: 500 }));

    const results = await engine.processQueue();
    expect(results).toHaveLength(1);
    expect(results[0]!.success).toBe(false);
    expect(results[0]!.statusCode).toBe(500);

    // Check the delivery was marked as failed with a next_retry_at.
    // getPendingDeliveries won't return it because next_retry_at is in the future,
    // so query directly.
    const result = await db.query<{
      status: string;
      attempts: number;
      next_retry_at: string | null;
    }>("SELECT status, attempts, next_retry_at FROM webhook_deliveries WHERE id = 1");
    expect(result.rows[0]!.status).toBe("failed");
    expect(result.rows[0]!.attempts).toBe(1);
    expect(result.rows[0]!.next_retry_at).toBeTruthy();
  });

  it("6th failure marks delivery as exhausted", async () => {
    const destId = await insertWebhookDestination(db, {
      name: "exhausted-hook",
      url: "https://example.com/hook",
    });

    const engine = createDeliveryEngine(db);
    await engine.enqueue(destId, makePayload());

    // Mock fetch to always fail
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("error", { status: 500 }));

    // Simulate MAX_ATTEMPTS failures by processing queue and resetting next_retry_at
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      // Reset next_retry_at so the delivery is picked up again
      await db.execute("UPDATE webhook_deliveries SET next_retry_at = NULL WHERE id = 1");
      await engine.processQueue();
    }

    const result = await db.query<{ status: string; attempts: number }>(
      "SELECT status, attempts FROM webhook_deliveries WHERE id = 1",
    );
    expect(result.rows[0]!.status).toBe("exhausted");
    expect(result.rows[0]!.attempts).toBe(MAX_ATTEMPTS);
  });

  it("successful delivery marks as delivered with response code", async () => {
    const destId = await insertWebhookDestination(db, {
      name: "success-hook",
      url: "https://example.com/hook",
    });

    const engine = createDeliveryEngine(db);
    await engine.enqueue(destId, makePayload());

    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("accepted", { status: 202 }));

    await engine.processQueue();

    const result = await db.query<{ status: string; response_code: number }>(
      "SELECT status, response_code FROM webhook_deliveries WHERE id = 1",
    );
    expect(result.rows[0]!.status).toBe("delivered");
    expect(result.rows[0]!.response_code).toBe(202);
  });

  it("timeout marks delivery as failed", async () => {
    const destId = await insertWebhookDestination(db, {
      name: "timeout-hook",
      url: "https://example.com/hook",
    });

    const engine = createDeliveryEngine(db);
    await engine.enqueue(destId, makePayload());

    // Mock fetch to throw timeout error
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new DOMException("The operation was aborted due to timeout", "TimeoutError"),
    );

    const results = await engine.processQueue();
    expect(results).toHaveLength(1);
    expect(results[0]!.success).toBe(false);
    expect(results[0]!.error).toContain("timeout");
  });

  it("unsigned delivery (no secret) omits signature header", async () => {
    const destId = await insertWebhookDestination(db, {
      name: "unsigned-hook",
      url: "https://example.com/hook",
      // No secret
    });

    const engine = createDeliveryEngine(db);
    await engine.enqueue(destId, makePayload());

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("ok", { status: 200 }));

    await engine.processQueue();

    const call = fetchSpy.mock.calls[0]!;
    const requestInit = call[1] as RequestInit;
    const headers = requestInit.headers as Record<string, string>;
    expect(headers["X-Warplane-Signature"]).toBeUndefined();
  });
});
