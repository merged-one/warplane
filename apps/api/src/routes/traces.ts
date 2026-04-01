import type { FastifyInstance } from "fastify";
import { listTraces, getTrace, getTraceEvents, getTimeline, countTraces, type TraceFilter } from "@warplane/storage";

export function registerTraceRoutes(app: FastifyInstance): void {
  app.get("/api/v1/traces", {
    schema: {
      description: "List message traces with optional filters",
      tags: ["traces"],
      querystring: {
        type: "object",
        properties: {
          scenario: { type: "string" },
          status: { type: "string", description: "Execution status filter" },
          chain: { type: "string", description: "Filter by source or destination blockchain ID" },
          sourceBlockchainId: { type: "string" },
          destinationBlockchainId: { type: "string" },
          messageId: { type: "string", description: "Partial message ID prefix search" },
          page: { type: "integer", minimum: 1, default: 1 },
          pageSize: { type: "integer", minimum: 1, maximum: 200, default: 50 },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            traces: { type: "array", items: { $ref: "MessageTrace" } },
            total: { type: "integer" },
            page: { type: "integer" },
            pageSize: { type: "integer" },
          },
        },
      },
    },
  }, async (request) => {
    const q = request.query as {
      scenario?: string;
      status?: string;
      chain?: string;
      sourceBlockchainId?: string;
      destinationBlockchainId?: string;
      messageId?: string;
      page?: number;
      pageSize?: number;
    };

    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 50;

    const filter: TraceFilter = {
      scenario: q.scenario,
      execution: q.status,
      sourceChain: q.sourceBlockchainId ?? q.chain,
      destChain: q.destinationBlockchainId ?? q.chain,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    };

    // If chain is specified without explicit source/dest, it means "either"
    // The storage layer ANDs source and dest, so only set one if generic chain filter
    if (q.chain && !q.sourceBlockchainId && !q.destinationBlockchainId) {
      // Query twice and merge (source OR dest)
      const fromSource = listTraces(app.db, { ...filter, sourceChain: q.chain, destChain: undefined });
      const fromDest = listTraces(app.db, { ...filter, sourceChain: undefined, destChain: q.chain });
      const seen = new Set<string>();
      const merged = [];
      for (const t of [...fromSource, ...fromDest]) {
        const key = `${t.messageId}:${t.scenario}`;
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(t);
        }
      }
      return { traces: merged, total: merged.length, page, pageSize };
    }

    const traces = listTraces(app.db, filter);
    const total = countTraces(app.db, { scenario: q.scenario, execution: q.status });

    return { traces, total, page, pageSize };
  });

  app.get("/api/v1/traces/:messageId", {
    schema: {
      description: "Get a single trace by message ID",
      tags: ["traces"],
      params: {
        type: "object",
        required: ["messageId"],
        properties: {
          messageId: { type: "string" },
        },
      },
      querystring: {
        type: "object",
        properties: {
          scenario: { type: "string" },
        },
      },
      response: {
        200: { $ref: "MessageTrace" },
        404: {
          type: "object",
          properties: { error: { type: "string" } },
        },
      },
    },
  }, async (request, reply) => {
    const { messageId } = request.params as { messageId: string };
    const { scenario } = request.query as { scenario?: string };
    const trace = getTrace(app.db, messageId, scenario);

    if (!trace) {
      return reply.status(404).send({ error: `Trace not found: ${messageId}` });
    }

    return trace;
  });

  app.get("/api/v1/traces/:messageId/timeline", {
    schema: {
      description: "Get ordered event timeline for a trace",
      tags: ["traces"],
      params: {
        type: "object",
        required: ["messageId"],
        properties: {
          messageId: { type: "string" },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            messageId: { type: "string" },
            events: { type: "array", items: { $ref: "MessageEvent" } },
          },
        },
        404: {
          type: "object",
          properties: { error: { type: "string" } },
        },
      },
    },
  }, async (request, reply) => {
    const { messageId } = request.params as { messageId: string };
    const events = getTraceEvents(app.db, messageId);

    if (events.length === 0) {
      // Check if trace exists at all
      const trace = getTrace(app.db, messageId);
      if (!trace) {
        return reply.status(404).send({ error: `Trace not found: ${messageId}` });
      }
    }

    return { messageId, events };
  });

  app.get("/api/v1/traces/:messageId/raw", {
    schema: {
      description: "Get the raw stored trace JSON (including all metadata)",
      tags: ["traces"],
      params: {
        type: "object",
        required: ["messageId"],
        properties: {
          messageId: { type: "string" },
        },
      },
      response: {
        404: {
          type: "object",
          properties: { error: { type: "string" } },
        },
      },
    },
  }, async (request, reply) => {
    const { messageId } = request.params as { messageId: string };
    const trace = getTrace(app.db, messageId);

    if (!trace) {
      return reply.status(404).send({ error: `Trace not found: ${messageId}` });
    }

    return trace;
  });
}
