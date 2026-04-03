/**
 * `warplane doctor` — check local environment readiness.
 */

import { Command } from "commander";
import { execSync } from "node:child_process";
import fs from "node:fs";
import { ApiClient } from "../api-client.js";
import { isJsonMode, printJson, heading, status, warn, hint } from "../output.js";

interface Check {
  name: string;
  ok: boolean;
  detail?: string;
}

export function doctorCommand(): Command {
  return new Command("doctor").description("Check local environment readiness").action(async () => {
    const client = new ApiClient();
    const checks: Check[] = [];

    // 1. Node.js version
    const nodeVer = process.version;
    const nodeMajor = Number(nodeVer.split(".")[0]?.replace("v", ""));
    checks.push({
      name: "node",
      ok: nodeMajor >= 20,
      detail: nodeVer + (nodeMajor < 20 ? " (need >= 20)" : ""),
    });

    // 2. pnpm
    const pnpmVer = tryExec("pnpm --version");
    checks.push({
      name: "pnpm",
      ok: pnpmVer !== null,
      detail: pnpmVer ?? "not found",
    });

    // 3. Go (optional — for harness)
    const goVer = tryExec("go version");
    if (goVer) {
      checks.push({ name: "go", ok: true, detail: goVer.replace("go version ", "") });
    } else {
      checks.push({
        name: "go",
        ok: false,
        detail: "not found (optional — needed for E2E harness)",
      });
    }

    // 4. Database URL
    const dbUrl = process.env["DATABASE_URL"];
    checks.push({
      name: "database",
      ok: !!dbUrl,
      detail: dbUrl ? "DATABASE_URL configured" : "DATABASE_URL not set (required for Postgres)",
    });

    // 5. API reachability
    const health = await client.ping();
    checks.push({
      name: "api",
      ok: health !== null,
      detail: health
        ? `${client.baseUrl} — ${health.traceCount} traces`
        : `not reachable at ${client.baseUrl}`,
    });

    // 6. Golden fixtures
    const fixturesDir = "harness/tmpnet/artifacts";
    const fixturesExist = fs.existsSync(fixturesDir) && fs.readdirSync(fixturesDir).length > 0;
    checks.push({
      name: "golden-fixtures",
      ok: fixturesExist,
      detail: fixturesExist ? fixturesDir : "not found — run `make golden` to generate",
    });

    // 7. docs-mcp build
    const mcpDist = "packages/docs-mcp/dist/index.js";
    const mcpBuilt = fs.existsSync(mcpDist);
    checks.push({
      name: "docs-mcp",
      ok: mcpBuilt,
      detail: mcpBuilt ? "built" : "not built — run `pnpm -F docs-mcp build`",
    });

    // 8. tmpnet prerequisites (AvalancheGo binary)
    const avalancheGo = tryExec("which avalanchego") ?? tryExec("which build/avalanchego");
    const hasAvago = avalancheGo !== null || process.env["AVALANCHEGO_PATH"] !== undefined;
    checks.push({
      name: "tmpnet-harness",
      ok: hasAvago,
      detail: hasAvago
        ? "AvalancheGo found"
        : "AvalancheGo not found (needed for E2E — see docs/runbooks/full-e2e.md)",
    });

    // Output
    const optionalChecks = new Set(["go", "tmpnet-harness"]);
    if (isJsonMode()) {
      const requiredOk = checks.every((c) => c.ok || optionalChecks.has(c.name));
      printJson({ ok: requiredOk, checks });
      process.exitCode = requiredOk ? 0 : 1;
      return;
    }

    heading("warplane doctor");
    for (const c of checks) {
      if (c.ok) {
        status(true, c.name, c.detail);
      } else if (["go", "tmpnet-harness"].includes(c.name)) {
        warn(c.name, c.detail);
      } else {
        status(false, c.name, c.detail);
      }
    }

    const failures = checks.filter((c) => !c.ok && !["go", "tmpnet-harness"].includes(c.name));
    if (failures.length > 0) {
      hint("Fix the issues above then re-run `warplane doctor`.");
      process.exitCode = 1;
    } else {
      hint("Environment looks good. Run `warplane demo seed` to load sample data.");
    }
  });
}

function tryExec(cmd: string): string | null {
  try {
    return execSync(cmd, {
      encoding: "utf8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return null;
  }
}
