/**
 * `icp failures list` — list traces with non-success execution status.
 */

import { Command } from "commander";
import { ApiClient } from "../api-client.js";
import { isJsonMode, printJson, heading, table, hint, shortId, truncate } from "../output.js";

export function failuresCommand(): Command {
  const failures = new Command("failures").description("Inspect failed or blocked traces");

  failures
    .command("list")
    .description("List traces with non-success execution status")
    .option("-s, --scenario <name>", "Filter by scenario")
    .action(async (opts: { scenario?: string }) => {
      const client = new ApiClient();
      const data = await client.get<{
        failures: Array<{
          messageId: string;
          scenario: string;
          execution: string;
          source: { name: string } | null;
          destination: { name: string } | null;
        }>;
      }>("/api/v1/failures", { scenario: opts.scenario });

      if (isJsonMode()) {
        printJson(data);
        return;
      }

      heading(`Failures (${data.failures.length})`);
      if (data.failures.length === 0) {
        console.log("  No failures found.");
        return;
      }

      table(
        ["MESSAGE ID", "SCENARIO", "STATUS", "SOURCE", "DEST"],
        data.failures.map((f) => [
          shortId(f.messageId),
          truncate(f.scenario, 28),
          f.execution,
          f.source?.name ?? "—",
          f.destination?.name ?? "—",
        ]),
      );
      hint("Show detail: warplane traces show <messageId>");
    });

  return failures;
}
