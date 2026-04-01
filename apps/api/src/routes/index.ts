/**
 * Route registration — wires all endpoint groups to the Fastify instance.
 */

import type { FastifyInstance } from "fastify";
import { registerHealthRoutes } from "./health.js";
import { registerNetworkRoutes } from "./network.js";
import { registerChainRoutes } from "./chains.js";
import { registerScenarioRoutes } from "./scenarios.js";
import { registerImportRoutes } from "./import.js";
import { registerTraceRoutes } from "./traces.js";
import { registerFailureRoutes } from "./failures.js";
import { registerSearchRoutes } from "./search.js";

export function registerRoutes(app: FastifyInstance): void {
  registerHealthRoutes(app);
  registerNetworkRoutes(app);
  registerChainRoutes(app);
  registerScenarioRoutes(app);
  registerImportRoutes(app);
  registerTraceRoutes(app);
  registerFailureRoutes(app);
  registerSearchRoutes(app);
}
