/**
 * Webhook destination CRUD and delivery history routes.
 */

import type { FastifyInstance } from "fastify";
import {
  insertWebhookDestination,
  getWebhookDestination,
  listWebhookDestinations,
  updateWebhookDestination,
  deleteWebhookDestination,
  getDeliveriesForDestination,
} from "@warplane/storage";
import { createDeliveryEngine } from "@warplane/ingest";

export function registerWebhookRoutes(app: FastifyInstance): void {
  // -----------------------------------------------------------------------
  // POST /api/v1/webhooks — Create destination
  // -----------------------------------------------------------------------
  app.post(
    "/api/v1/webhooks",
    {
      schema: {
        description: "Create a webhook destination",
        tags: ["webhooks"],
        body: {
          type: "object",
          required: ["name", "url"],
          properties: {
            name: { type: "string" },
            url: { type: "string", format: "uri" },
            secret: { type: "string" },
            enabled: { type: "boolean" },
            events: { type: "array", items: { type: "string" } },
          },
        },
        response: {
          201: {
            type: "object",
            properties: { id: { type: "integer" } },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as {
        name: string;
        url: string;
        secret?: string;
        enabled?: boolean;
        events?: string[];
      };
      const id = await insertWebhookDestination(app.db, body);
      return reply.code(201).send({ id });
    },
  );

  // -----------------------------------------------------------------------
  // GET /api/v1/webhooks — List destinations
  // -----------------------------------------------------------------------
  app.get(
    "/api/v1/webhooks",
    {
      schema: {
        description: "List webhook destinations",
        tags: ["webhooks"],
        response: {
          200: {
            type: "object",
            properties: {
              destinations: { type: "array", items: { type: "object" } },
            },
          },
        },
      },
    },
    async () => {
      const destinations = await listWebhookDestinations(app.db);
      return { destinations };
    },
  );

  // -----------------------------------------------------------------------
  // PUT /api/v1/webhooks/:id — Update destination
  // -----------------------------------------------------------------------
  app.put(
    "/api/v1/webhooks/:id",
    {
      schema: {
        description: "Update a webhook destination",
        tags: ["webhooks"],
        params: {
          type: "object",
          properties: { id: { type: "integer" } },
          required: ["id"],
        },
        body: {
          type: "object",
          properties: {
            name: { type: "string" },
            url: { type: "string", format: "uri" },
            secret: { type: "string" },
            enabled: { type: "boolean" },
            events: { type: "array", items: { type: "string" } },
          },
        },
        response: {
          200: { type: "object", properties: { ok: { type: "boolean" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: number };
      const existing = await getWebhookDestination(app.db, id);
      if (!existing) return reply.code(404).send({ error: "Not found" });

      const body = request.body as Partial<{
        name: string;
        url: string;
        secret: string;
        enabled: boolean;
        events: string[];
      }>;
      await updateWebhookDestination(app.db, id, body);
      return { ok: true };
    },
  );

  // -----------------------------------------------------------------------
  // DELETE /api/v1/webhooks/:id — Delete destination
  // -----------------------------------------------------------------------
  app.delete(
    "/api/v1/webhooks/:id",
    {
      schema: {
        description: "Delete a webhook destination",
        tags: ["webhooks"],
        params: {
          type: "object",
          properties: { id: { type: "integer" } },
          required: ["id"],
        },
        response: {
          200: { type: "object", properties: { ok: { type: "boolean" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: number };
      const existing = await getWebhookDestination(app.db, id);
      if (!existing) return reply.code(404).send({ error: "Not found" });

      await deleteWebhookDestination(app.db, id);
      return { ok: true };
    },
  );

  // -----------------------------------------------------------------------
  // POST /api/v1/webhooks/:id/test — Send test payload
  // -----------------------------------------------------------------------
  app.post(
    "/api/v1/webhooks/:id/test",
    {
      schema: {
        description: "Send a test payload to verify webhook connectivity",
        tags: ["webhooks"],
        params: {
          type: "object",
          properties: { id: { type: "integer" } },
          required: ["id"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              statusCode: { type: ["integer", "null"] },
              error: { type: ["string", "null"] },
            },
          },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: number };
      const dest = await getWebhookDestination(app.db, id);
      if (!dest) return reply.code(404).send({ error: "Not found" });

      const engine = createDeliveryEngine(app.db);
      const payload = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        type: "test",
        messageId: "test-message",
        data: { test: true },
      };
      await engine.enqueue(id, payload);
      const results = await engine.processQueue();
      const result = results[0];

      return {
        success: result?.success ?? false,
        statusCode: result?.statusCode ?? null,
        error: result?.error ?? null,
      };
    },
  );

  // -----------------------------------------------------------------------
  // GET /api/v1/webhooks/:id/deliveries — Delivery history
  // -----------------------------------------------------------------------
  app.get(
    "/api/v1/webhooks/:id/deliveries",
    {
      schema: {
        description: "Delivery history for a webhook destination",
        tags: ["webhooks"],
        params: {
          type: "object",
          properties: { id: { type: "integer" } },
          required: ["id"],
        },
        querystring: {
          type: "object",
          properties: {
            limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              deliveries: { type: "array", items: { type: "object" } },
            },
          },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: number };
      const dest = await getWebhookDestination(app.db, id);
      if (!dest) return reply.code(404).send({ error: "Not found" });

      const q = request.query as { limit?: number };
      const deliveries = await getDeliveriesForDestination(app.db, id, {
        limit: q.limit,
      });
      return { deliveries };
    },
  );
}
