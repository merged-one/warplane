/**
 * Alert rule CRUD routes.
 */

import type { FastifyInstance } from "fastify";
import {
  insertAlertRule,
  getAlertRule,
  listAlertRules,
  updateAlertRule,
  deleteAlertRule,
  type AlertCondition,
} from "@warplane/storage";

export function registerAlertRoutes(app: FastifyInstance): void {
  // -----------------------------------------------------------------------
  // POST /api/v1/alerts/rules — Create alert rule
  // -----------------------------------------------------------------------
  app.post(
    "/api/v1/alerts/rules",
    {
      schema: {
        description: "Create an alert rule",
        tags: ["alerts"],
        body: {
          type: "object",
          required: ["name", "condition", "destinations"],
          properties: {
            name: { type: "string" },
            condition: {
              type: "object",
              properties: {
                type: { type: "string" },
              },
            },
            destinations: { type: "array", items: { type: "integer" } },
            enabled: { type: "boolean" },
            cooldownMs: { type: "integer", minimum: 0 },
          },
        },
        response: {
          201: {
            type: "object",
            properties: { id: { type: "string" } },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as {
        name: string;
        condition: AlertCondition;
        destinations: number[];
        enabled?: boolean;
        cooldownMs?: number;
      };
      const id = await insertAlertRule(app.asyncDb, body);
      return reply.code(201).send({ id });
    },
  );

  // -----------------------------------------------------------------------
  // GET /api/v1/alerts/rules — List alert rules
  // -----------------------------------------------------------------------
  app.get(
    "/api/v1/alerts/rules",
    {
      schema: {
        description: "List alert rules",
        tags: ["alerts"],
        querystring: {
          type: "object",
          properties: {
            enabled: { type: "boolean" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              rules: { type: "array", items: { type: "object" } },
            },
          },
        },
      },
    },
    async (request) => {
      const q = request.query as { enabled?: boolean };
      const rules = await listAlertRules(app.asyncDb, {
        enabled: q.enabled,
      });
      return { rules };
    },
  );

  // -----------------------------------------------------------------------
  // PUT /api/v1/alerts/rules/:id — Update alert rule
  // -----------------------------------------------------------------------
  app.put(
    "/api/v1/alerts/rules/:id",
    {
      schema: {
        description: "Update an alert rule",
        tags: ["alerts"],
        params: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
        body: {
          type: "object",
          properties: {
            name: { type: "string" },
            condition: { type: "object" },
            destinations: { type: "array", items: { type: "integer" } },
            enabled: { type: "boolean" },
            cooldownMs: { type: "integer", minimum: 0 },
          },
        },
        response: {
          200: { type: "object", properties: { ok: { type: "boolean" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const existing = await getAlertRule(app.asyncDb, id);
      if (!existing) return reply.code(404).send({ error: "Not found" });

      const body = request.body as Partial<{
        name: string;
        condition: AlertCondition;
        destinations: number[];
        enabled: boolean;
        cooldownMs: number;
      }>;
      await updateAlertRule(app.asyncDb, id, body);
      return { ok: true };
    },
  );

  // -----------------------------------------------------------------------
  // DELETE /api/v1/alerts/rules/:id — Delete alert rule
  // -----------------------------------------------------------------------
  app.delete(
    "/api/v1/alerts/rules/:id",
    {
      schema: {
        description: "Delete an alert rule",
        tags: ["alerts"],
        params: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
        response: {
          200: { type: "object", properties: { ok: { type: "boolean" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const existing = await getAlertRule(app.asyncDb, id);
      if (!existing) return reply.code(404).send({ error: "Not found" });

      await deleteAlertRule(app.asyncDb, id);
      return { ok: true };
    },
  );
}
