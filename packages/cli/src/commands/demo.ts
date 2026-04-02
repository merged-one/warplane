/**
 * `warplane demo seed` — seed the local API with golden fixtures.
 * `warplane demo start` — start the API in demo mode.
 */

import { Command } from "commander";
import { spawn } from "node:child_process";
import { ApiClient } from "../api-client.js";
import { isJsonMode, printJson, heading, detail, hint } from "../output.js";

export function demoCommand(): Command {
  const demo = new Command("demo").description("Seeded demo helpers");

  demo
    .command("seed")
    .description("Seed the running API with golden fixture data")
    .action(async () => {
      const client = new ApiClient();
      const health = await client.ping();

      if (!health) {
        if (isJsonMode()) {
          printJson({ error: "API not reachable", hint: "Start the API first: pnpm dev" });
        } else {
          console.error("API is not running. Start it first:\n\n  pnpm dev\n");
        }
        process.exitCode = 1;
        return;
      }

      try {
        const result = await client.post<{
          importId: number;
          networks: number;
          chains: number;
          scenarios: number;
          traces: number;
          errors: string[];
        }>("/api/v1/import", {
          artifactsDir: "harness/tmpnet/artifacts",
          sourceType: "demo-seed",
        });

        if (isJsonMode()) {
          printJson(result);
          return;
        }

        heading("Demo data seeded");
        detail("Import ID", result.importId);
        detail("Networks", result.networks);
        detail("Chains", result.chains);
        detail("Scenarios", result.scenarios);
        detail("Traces", result.traces);
        if (result.errors.length > 0) {
          detail("Errors", result.errors.join(", "));
        }
        hint("Try: warplane traces list");
      } catch (err) {
        if (isJsonMode()) {
          printJson({ error: String(err) });
        } else {
          console.error(`Seed failed: ${err}`);
        }
        process.exitCode = 1;
      }
    });

  demo
    .command("start")
    .description("Start the API server in demo mode (foreground)")
    .option("-p, --port <port>", "API port", "3100")
    .action((opts: { port: string }) => {
      console.log(`Starting API in demo mode on port ${opts.port}…`);
      console.log("Press Ctrl+C to stop.\n");

      const child = spawn("pnpm", ["dev"], {
        stdio: "inherit",
        env: { ...process.env, PORT: opts.port, DEMO_MODE: "true" },
        cwd: process.cwd(),
      });

      child.on("error", (err) => {
        console.error(`Failed to start API: ${err.message}`);
        process.exitCode = 1;
      });

      child.on("exit", (code) => {
        process.exitCode = code ?? 0;
      });
    });

  return demo;
}
