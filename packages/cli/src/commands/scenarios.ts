/**
 * `icp scenarios list` — list scenario runs.
 */

import { Command } from "commander";
import { ApiClient } from "../api-client.js";
import { isJsonMode, printJson, heading, table, truncate } from "../output.js";

export function scenariosCommand(): Command {
  const scenarios = new Command("scenarios").description("Inspect test scenario runs");

  scenarios
    .command("list")
    .description("List all scenario runs")
    .action(async () => {
      const client = new ApiClient();
      const data = await client.get<{
        scenarios: Array<{
          scenario: string;
          passed: boolean;
          startedAt: string;
          completedAt: string;
          messageIds: string[];
          error?: string;
        }>;
      }>("/api/v1/scenarios");

      if (isJsonMode()) {
        printJson(data);
        return;
      }

      heading(`Scenarios (${data.scenarios.length})`);
      table(
        ["SCENARIO", "PASSED", "MESSAGES", "STARTED", "ERROR"],
        data.scenarios.map((s) => [
          truncate(s.scenario, 32),
          s.passed ? "yes" : "NO",
          String(s.messageIds.length),
          formatTime(s.startedAt),
          truncate(s.error ?? "", 30),
        ]),
      );
    });

  return scenarios;
}

function formatTime(iso: string | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "Z");
  } catch {
    return iso;
  }
}
