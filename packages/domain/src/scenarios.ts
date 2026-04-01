/**
 * Scenario run schemas for test harness output.
 *
 * A ScenarioRun captures metadata about a single scenario execution:
 * which scenario ran, whether it passed, what messages were produced.
 *
 * @module scenarios
 * @version 1.0.0
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Scenario run
// ---------------------------------------------------------------------------

export const ScenarioRun = z.object({
  scenario: z.string(),
  startedAt: z.string().datetime({ offset: true }),
  completedAt: z.string().datetime({ offset: true }),
  passed: z.boolean(),
  messageIds: z.array(z.string()),
  traceFiles: z.array(z.string()),
  error: z.string().optional(),
  tags: z.array(z.string()).optional(),
});
export type ScenarioRun = z.infer<typeof ScenarioRun>;
