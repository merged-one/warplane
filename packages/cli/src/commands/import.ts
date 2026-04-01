/**
 * `icp import <artifactDir>` — import artifacts via the API.
 */

import { Command } from "commander";
import { ApiClient } from "../api-client.js";
import { isJsonMode, printJson, heading, detail } from "../output.js";

export function importCommand(): Command {
  return new Command("import")
    .description("Import trace artifacts from a local directory")
    .argument("<artifactDir>", "Path to the artifacts directory")
    .option("--source-type <type>", "Source type label", "manual")
    .action(async (artifactDir: string, opts: { sourceType: string }) => {
      const client = new ApiClient();

      const result = await client.post<{
        importId: number;
        networks: number;
        chains: number;
        scenarios: number;
        traces: number;
        errors: string[];
      }>("/api/v1/import", {
        artifactsDir: artifactDir,
        sourceType: opts.sourceType,
      });

      if (isJsonMode()) {
        printJson(result);
        return;
      }

      heading("Import complete");
      detail("Import ID", result.importId);
      detail("Networks", result.networks);
      detail("Chains", result.chains);
      detail("Scenarios", result.scenarios);
      detail("Traces", result.traces);
      if (result.errors.length > 0) {
        console.log(`\n  Errors:`);
        for (const e of result.errors) {
          console.log(`    - ${e}`);
        }
      }
    });
}
