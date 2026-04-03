/**
 * Repository functions for scenario runs.
 *
 * Async, Postgres-native. Uses DatabaseAdapter interface.
 */

import type { DatabaseAdapter } from "../adapter.js";
import type { ScenarioRun } from "@warplane/domain";

export async function upsertScenarioRun(
  db: DatabaseAdapter,
  run: ScenarioRun,
  importId?: number,
): Promise<number> {
  const result = await db.query<{ id: number }>(
    `INSERT INTO scenario_runs (scenario, started_at, completed_at, passed, error,
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
     RETURNING id`,
    [
      run.scenario,
      run.startedAt,
      run.completedAt,
      run.passed ? 1 : 0,
      run.error ?? null,
      run.tags ? JSON.stringify(run.tags) : null,
      JSON.stringify(run.messageIds),
      JSON.stringify(run.traceFiles),
      importId ?? null,
    ],
  );
  return result.rows[0]!.id;
}

export async function getScenarioRun(
  db: DatabaseAdapter,
  scenario: string,
): Promise<ScenarioRun | undefined> {
  const result = await db.query<Record<string, unknown>>(
    `SELECT scenario, started_at, completed_at, passed, error,
            tags_json, message_ids_json, trace_files_json
     FROM scenario_runs WHERE scenario = ? ORDER BY started_at DESC LIMIT 1`,
    [scenario],
  );

  const row = result.rows[0];
  if (!row) return undefined;

  return mapScenarioRow(row);
}

export async function listScenarioRuns(db: DatabaseAdapter): Promise<ScenarioRun[]> {
  const result = await db.query<Record<string, unknown>>(
    `SELECT scenario, started_at, completed_at, passed, error,
            tags_json, message_ids_json, trace_files_json
     FROM scenario_runs ORDER BY started_at DESC`,
  );

  return result.rows.map(mapScenarioRow);
}

function mapScenarioRow(row: Record<string, unknown>): ScenarioRun {
  return {
    scenario: row.scenario as string,
    startedAt: row.started_at as string,
    completedAt: row.completed_at as string,
    passed: Boolean(row.passed),
    error: (row.error as string) || undefined,
    tags: row.tags_json ? JSON.parse(row.tags_json as string) : undefined,
    messageIds: JSON.parse(row.message_ids_json as string),
    traceFiles: JSON.parse(row.trace_files_json as string),
  };
}
