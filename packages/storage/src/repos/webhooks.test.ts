import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { openDb, closeDb, type Database } from "../db.js";
import { runMigrations } from "../migrate.js";
import { createSqliteAdapter } from "../sqlite-adapter.js";
import type { DatabaseAdapter } from "../adapter.js";
import {
  insertWebhookDestination,
  getWebhookDestination,
  listWebhookDestinations,
  updateWebhookDestination,
  deleteWebhookDestination,
  insertWebhookDelivery,
  markDeliveryStatus,
  getPendingDeliveries,
  getDeliveriesForMessage,
} from "./webhooks.js";

let rawDb: Database;
let db: DatabaseAdapter;

beforeEach(() => {
  rawDb = openDb({ path: ":memory:" });
  runMigrations(rawDb);
  db = createSqliteAdapter(rawDb);
});

afterEach(() => {
  closeDb(rawDb);
});

describe("Webhook Destinations", () => {
  it("inserts and retrieves a destination", async () => {
    const id = await insertWebhookDestination(db, {
      name: "slack-alerts",
      url: "https://hooks.slack.com/services/xxx",
      secret: "mysecret",
      events: ["execution_failed", "delivery_confirmed"],
    });
    expect(id).toBeGreaterThan(0);

    const dest = await getWebhookDestination(db, id);
    expect(dest).toBeDefined();
    expect(dest!.name).toBe("slack-alerts");
    expect(dest!.url).toBe("https://hooks.slack.com/services/xxx");
    expect(dest!.secret).toBe("mysecret");
    expect(dest!.enabled).toBe(true);
    expect(dest!.events).toEqual(["execution_failed", "delivery_confirmed"]);
  });

  it("returns undefined for unknown id", async () => {
    const dest = await getWebhookDestination(db, 999);
    expect(dest).toBeUndefined();
  });

  it("lists destinations with enabledOnly filter", async () => {
    await insertWebhookDestination(db, { name: "active", url: "https://a.com" });
    await insertWebhookDestination(db, {
      name: "disabled",
      url: "https://b.com",
      enabled: false,
    });

    const all = await listWebhookDestinations(db);
    expect(all).toHaveLength(2);

    const enabled = await listWebhookDestinations(db, { enabledOnly: true });
    expect(enabled).toHaveLength(1);
    expect(enabled[0]!.name).toBe("active");
  });

  it("updates destination fields", async () => {
    const id = await insertWebhookDestination(db, {
      name: "original",
      url: "https://original.com",
    });

    await updateWebhookDestination(db, id, {
      name: "updated",
      url: "https://updated.com",
      enabled: false,
    });

    const dest = await getWebhookDestination(db, id);
    expect(dest!.name).toBe("updated");
    expect(dest!.url).toBe("https://updated.com");
    expect(dest!.enabled).toBe(false);
  });

  it("deletes destination and cascades to deliveries", async () => {
    const destId = await insertWebhookDestination(db, {
      name: "to-delete",
      url: "https://del.com",
    });
    await insertWebhookDelivery(db, {
      destinationId: destId,
      messageId: "msg-1",
      eventKind: "execution_failed",
      payloadJson: "{}",
    });

    await deleteWebhookDestination(db, destId);

    const dest = await getWebhookDestination(db, destId);
    expect(dest).toBeUndefined();

    const deliveries = await getDeliveriesForMessage(db, "msg-1");
    expect(deliveries).toHaveLength(0);
  });
});

describe("Webhook Deliveries", () => {
  let destId: number;

  beforeEach(async () => {
    destId = await insertWebhookDestination(db, {
      name: "test-dest",
      url: "https://test.com/webhook",
    });
  });

  it("inserts a delivery and retrieves it", async () => {
    const id = await insertWebhookDelivery(db, {
      destinationId: destId,
      messageId: "msg-1",
      eventKind: "execution_failed",
      payloadJson: '{"trace":"data"}',
    });
    expect(id).toBeGreaterThan(0);

    const deliveries = await getDeliveriesForMessage(db, "msg-1");
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0]!.status).toBe("pending");
    expect(deliveries[0]!.attempts).toBe(0);
  });

  it("marks delivery as delivered", async () => {
    const id = await insertWebhookDelivery(db, {
      destinationId: destId,
      messageId: "msg-1",
      eventKind: "execution_failed",
      payloadJson: "{}",
    });

    await markDeliveryStatus(db, id, "delivered", { responseCode: 200 });

    const deliveries = await getDeliveriesForMessage(db, "msg-1");
    expect(deliveries[0]!.status).toBe("delivered");
    expect(deliveries[0]!.attempts).toBe(1);
    expect(deliveries[0]!.responseCode).toBe(200);
  });

  it("marks delivery as failed with retry", async () => {
    const id = await insertWebhookDelivery(db, {
      destinationId: destId,
      messageId: "msg-1",
      eventKind: "execution_failed",
      payloadJson: "{}",
    });

    await markDeliveryStatus(db, id, "failed", {
      responseCode: 500,
      responseBody: "Internal Server Error",
      nextRetryAt: "2099-01-01T00:00:00.000Z",
    });

    const deliveries = await getDeliveriesForMessage(db, "msg-1");
    expect(deliveries[0]!.status).toBe("failed");
    expect(deliveries[0]!.nextRetryAt).toBe("2099-01-01T00:00:00.000Z");
  });

  it("getPendingDeliveries returns pending and failed-ready deliveries", async () => {
    await insertWebhookDelivery(db, {
      destinationId: destId,
      messageId: "msg-1",
      eventKind: "execution_failed",
      payloadJson: "{}",
    });

    const pending = await getPendingDeliveries(db);
    expect(pending).toHaveLength(1);
    expect(pending[0]!.messageId).toBe("msg-1");
  });

  it("getPendingDeliveries respects limit", async () => {
    for (let i = 0; i < 5; i++) {
      await insertWebhookDelivery(db, {
        destinationId: destId,
        messageId: `msg-${i}`,
        eventKind: "execution_failed",
        payloadJson: "{}",
      });
    }

    const pending = await getPendingDeliveries(db, { limit: 2 });
    expect(pending).toHaveLength(2);
  });
});
