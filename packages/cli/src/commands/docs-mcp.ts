/**
 * `icp docs mcp` — start or check the docs MCP server.
 */

import { Command } from "commander";
import { spawn } from "node:child_process";
import fs from "node:fs";
import { isJsonMode, printJson, heading, status, hint } from "../output.js";

export function docsMcpCommand(): Command {
  const docs = new Command("docs").description("Documentation tools");

  docs
    .command("mcp")
    .description("Start the docs MCP server (stdio transport)")
    .option("--check", "Only check if the MCP server is built")
    .action((opts: { check?: boolean }) => {
      const distPath = "packages/docs-mcp/dist/index.js";
      const built = fs.existsSync(distPath);

      if (opts.check) {
        if (isJsonMode()) {
          printJson({ built, path: distPath });
        } else {
          heading("Docs MCP server");
          status(built, "build", built ? distPath : "not built");
          if (!built) {
            hint("Build it: pnpm -F docs-mcp build");
          }
        }
        return;
      }

      if (!built) {
        console.error(
          `MCP server not built. Build it first:\n\n  pnpm -F docs-mcp build\n`,
        );
        process.exitCode = 1;
        return;
      }

      console.error("Starting docs MCP server (stdio)…");
      const child = spawn("node", [distPath], {
        stdio: "inherit",
      });

      child.on("error", (err) => {
        console.error(`Failed to start MCP server: ${err.message}`);
        process.exitCode = 1;
      });

      child.on("exit", (code) => {
        process.exitCode = code ?? 0;
      });
    });

  return docs;
}
