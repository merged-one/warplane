/**
 * Repository functions for scenario runs.
 */

import type { Database } from "better-sqlite3";
import type { ScenarioRun } from "@warplane/domain";

export function upsertScenarioRun(
  db: Database,
  run: ScenarioRun,
  importId?: number,
): number {
  const stmt = db.prepare(`
    INSERT INTO scenario_runs (scenario, started_at, completed_at, passed, error,
      tags_json, message_ids_json, trace_files_json, import_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(scenario, started_at) DO UPDATE SET
      completed_at = excluded.completed_at,
      passed = excluded.passed,
      error = excluded.error,
      tags_json = excluded.tags_json,
      message_ids_json = excluded.message_ids_json,
      trace_files_json = excluded.trace_files_json,
      import_id = excluded.import_id
    RETURNING id
  `);
  const row = stmt.get(
    run.scenario,
    run.startedAt,
    run.completedAt,
    run.passed ? 1 : 0,
    run.error ?? null,
    run.tags ? JSON.stringify(run.tags) : null,
    JSON.stringify(run.messageIds),
    JSON.stringify(run.traceFiles),
    importId ?? null,
  ) as { id: number };
  return row.id;
}

export function getScenarioRun(db: Database, scenario: string): ScenarioRun | undefined {
  const row = db
    .prepare(
      `SELECT scenario, started_at, completed_at, passed, error,
              tags_json, message_ids_json, trace_files_json
       FROM scenario_runs WHERE scenario = ? ORDER BY started_at DESC LIMIT 1`,
    )
    .get(scenario) as Record<string, unknown> | undefined;

  if (!row) return undefined;

  return {
    scenario: row.scenario as string,
    startedAt: row.started_at as string,
    completedAt: row.completed_at as string,
    passed: (row.passed as number) === 1,
    error: (row.error as string) || undefined,
    tags: row.tags_json ? JSON.parse(row.tags_json as string) : undefined,
    messageIds: JSON.parse(row.message_ids_json as string),
    traceFiles: JSON.parse(row.trace_files_json as string),
  };
}

export function listScenarioRuns(db: Database): ScenarioRun[] {
  const rows = db
    .prepare(
      `SELECT scenario, started_at, completed_at, passed, error,
              tags_json, message_ids_json, trace_files_json
       FROM scenario_runs ORDER BY started_at DESC`,
    )
    .all() as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    scenario: row.scenario as string,
    startedAt: row.started_at as string,
    completedAt: row.completed_at as string,
    passed: (row.passed as number) === 1,
    error: (row.error as string) || undefined,
    tags: row.tags_json ? JSON.parse(row.tags_json as string) : undefined,
    messageIds: JSON.parse(row.message_ids_json as string),
    traceFiles: JSON.parse(row.trace_files_json as string),
  }));
}
