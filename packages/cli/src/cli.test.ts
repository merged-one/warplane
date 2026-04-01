/**
 * CLI integration tests.
 *
 * Spawns the CLI as child processes against an in-process test API server.
 * Uses async exec so the Fastify event loop can handle requests.
 */

import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import { buildApp } from "../../../apps/api/src/app.js";
import type { FastifyInstance } from "fastify";

const execAsync = promisify(exec);
const CLI = path.resolve(import.meta.dirname ?? ".", "../dist/index.js");
const REPO_ROOT = path.resolve(import.meta.dirname ?? ".", "../../..");

let app: FastifyInstance;
let apiUrl: string;

async function run(
  args: string,
  env?: Record<string, string>,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const { stdout, stderr } = await execAsync(`node ${CLI} ${args}`, {
      timeout: 15_000,
      env: { ...process.env, ICP_API_URL: apiUrl, ...env },
      cwd: REPO_ROOT,
    });
    return { stdout, stderr, exitCode: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; code?: number };
    return {
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? "",
      exitCode: e.code ?? 1,
    };
  }
}

beforeAll(async () => {
  if (!fs.existsSync(CLI)) {
    throw new Error(`CLI not built at ${CLI}. Run "pnpm -F @warplane/cli build" first.`);
  }

  app = await buildApp({
    dbPath: ":memory:",
    demoMode: true,
    logger: false,
  });
  await app.ready();
  const addr = await app.listen({ port: 0, host: "127.0.0.1" });
  apiUrl = addr;
});

afterAll(async () => {
  if (app) await app.close();
});

// ---------------------------------------------------------------------------
// Basic CLI behavior
// ---------------------------------------------------------------------------

describe("warplane --help", () => {
  it("shows help text with all commands listed", async () => {
    const { stdout, exitCode } = await run("--help");
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Interchain Control Plane CLI");
    expect(stdout).toContain("doctor");
    expect(stdout).toContain("traces");
    expect(stdout).toContain("failures");
    expect(stdout).toContain("scenarios");
    expect(stdout).toContain("import");
    expect(stdout).toContain("registry");
    expect(stdout).toContain("docs");
    expect(stdout).toContain("completion");
  });
});

describe("warplane --version", () => {
  it("shows version", async () => {
    const { stdout, exitCode } = await run("--version");
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe("warplane --api-url flag", () => {
  it("overrides default API URL", async () => {
    const { stdout, stderr, exitCode } = await run(
      "--api-url http://localhost:19999 traces list",
      // Clear ICP_API_URL so --api-url takes effect
      { ICP_API_URL: "" },
    );
    expect(exitCode).toBe(1);
    const combined = stdout + stderr;
    expect(combined).toContain("Cannot reach the API");
    expect(combined).toContain("http://localhost:19999");
  });

  it("connects to custom URL when valid", async () => {
    const { stdout, exitCode } = await run(
      `--api-url ${apiUrl} --json traces list`,
      { ICP_API_URL: "" },
    );
    expect(exitCode).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.traces.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Doctor
// ---------------------------------------------------------------------------

describe("warplane doctor", () => {
  it("runs checks and outputs JSON", async () => {
    const { stdout } = await run("--json doctor");
    const data = JSON.parse(stdout);
    expect(data.checks).toBeInstanceOf(Array);
    expect(data.checks.length).toBeGreaterThanOrEqual(7);
    expect(data.checks.find((c: { name: string }) => c.name === "node").ok).toBe(true);
    expect(data.checks.find((c: { name: string }) => c.name === "pnpm").ok).toBe(true);
    expect(data.checks.find((c: { name: string }) => c.name === "api").ok).toBe(true);
    expect(data.checks.find((c: { name: string }) => c.name === "api").detail).toContain("traces");
  });

  it("outputs TTY-formatted text (non-JSON)", async () => {
    const { stdout, exitCode } = await run("doctor");
    // Should contain the heading and check names
    expect(stdout).toContain("warplane doctor");
    expect(stdout).toContain("node");
    expect(stdout).toContain("pnpm");
    expect(stdout).toContain("api");
    expect(stdout).toContain("database");
    expect(stdout).toContain("golden-fixtures");
    // Optional checks should be listed
    expect(stdout).toContain("tmpnet-harness");
  });

  it("treats optional checks as warnings (not failures) in JSON", async () => {
    const { stdout } = await run("--json doctor");
    const data = JSON.parse(stdout);
    // tmpnet-harness is optional — even if not ok, doctor.ok should not fail
    const tmpnet = data.checks.find((c: { name: string }) => c.name === "tmpnet-harness");
    if (tmpnet && !tmpnet.ok) {
      // ok should still be true if only optional checks fail
      const requiredFailing = data.checks.filter(
        (c: { name: string; ok: boolean }) =>
          !c.ok && c.name !== "go" && c.name !== "tmpnet-harness",
      );
      if (requiredFailing.length === 0) {
        expect(data.ok).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Traces list
// ---------------------------------------------------------------------------

describe("warplane traces list", () => {
  it("lists traces in JSON mode", async () => {
    const { stdout, exitCode } = await run("--json traces list");
    expect(exitCode).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.traces).toBeInstanceOf(Array);
    expect(data.traces.length).toBeGreaterThan(0);
    expect(data.total).toBeGreaterThan(0);
    expect(data.page).toBe(1);
    expect(data.pageSize).toBeDefined();
  });

  it("lists traces in TTY mode with table headers", async () => {
    const { stdout, exitCode } = await run("traces list");
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Traces");
    expect(stdout).toContain("MESSAGE ID");
    expect(stdout).toContain("SCENARIO");
    expect(stdout).toContain("STATUS");
    expect(stdout).toContain("SOURCE");
    expect(stdout).toContain("DEST");
    expect(stdout).toContain("SEND TIME");
  });

  it("shows hint for next command in TTY mode", async () => {
    const { stdout } = await run("traces list");
    expect(stdout).toContain("warplane traces show");
  });

  it("filters by scenario", async () => {
    const { stdout } = await run("--json traces list --scenario basic_send_receive");
    const data = JSON.parse(stdout);
    expect(data.traces.length).toBeGreaterThan(0);
    for (const t of data.traces) {
      expect(t.scenario).toBe("basic_send_receive");
    }
  });

  it("filters by status", async () => {
    const { stdout } = await run("--json traces list --status success");
    const data = JSON.parse(stdout);
    expect(data.traces.length).toBeGreaterThan(0);
    for (const t of data.traces) {
      expect(t.execution).toBe("success");
    }
  });

  it("filters by chain", async () => {
    const { stdout } = await run("--json traces list --chain chain-src-001");
    const data = JSON.parse(stdout);
    expect(data.traces.length).toBeGreaterThan(0);
    for (const t of data.traces) {
      const hasChain =
        t.source?.blockchainId === "chain-src-001" ||
        t.destination?.blockchainId === "chain-src-001";
      expect(hasChain).toBe(true);
    }
  });

  it("respects --limit / -n flag", async () => {
    const { stdout } = await run("--json traces list -n 2");
    const data = JSON.parse(stdout);
    expect(data.traces.length).toBeLessThanOrEqual(2);
  });

  it("returns empty results for non-matching filter", async () => {
    const { stdout, exitCode } = await run("--json traces list --scenario nonexistent_scenario_xyz");
    expect(exitCode).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.traces).toEqual([]);
    expect(data.total).toBe(0);
  });

  it("empty results render gracefully in TTY mode", async () => {
    const { stdout, exitCode } = await run("traces list --scenario nonexistent_scenario_xyz");
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Traces (0 total)");
    expect(stdout).toContain("no results");
  });
});

// ---------------------------------------------------------------------------
// Traces show
// ---------------------------------------------------------------------------

describe("warplane traces show", () => {
  let messageId: string;

  beforeAll(async () => {
    const { stdout } = await run("--json traces list -n 1");
    messageId = JSON.parse(stdout).traces[0].messageId;
  });

  it("shows trace detail by full ID (JSON)", async () => {
    const { stdout, exitCode } = await run(`--json traces show ${messageId}`);
    expect(exitCode).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.messageId).toBe(messageId);
    expect(data.timeline).toBeInstanceOf(Array);
    expect(data.timeline.length).toBeGreaterThan(0);
    expect(data.source).toBeDefined();
    expect(data.destination).toBeDefined();
    expect(data.sender).toBeDefined();
    expect(data.recipient).toBeDefined();
    expect(data.execution).toBeDefined();
  });

  it("shows trace detail by partial ID (JSON)", async () => {
    const partial = messageId.slice(0, 8);
    const { stdout, exitCode } = await run(`--json traces show ${partial}`);
    expect(exitCode).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.messageId).toBe(messageId);
  });

  it("shows trace in TTY mode with all sections", async () => {
    const { stdout, exitCode } = await run(`traces show ${messageId}`);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Trace:");
    expect(stdout).toContain("Message ID");
    expect(stdout).toContain("Scenario");
    expect(stdout).toContain("Source");
    expect(stdout).toContain("Destination");
    expect(stdout).toContain("Sender");
    expect(stdout).toContain("Timeline");
    expect(stdout).toContain("EVENT");
  });

  it("returns error for unknown ID", async () => {
    const { stdout, exitCode } = await run("--json traces show nonexistent999");
    expect(exitCode).toBe(1);
    const data = JSON.parse(stdout);
    expect(data.error).toBeDefined();
    expect(data.error).toContain("nonexistent999");
  });
});

// ---------------------------------------------------------------------------
// Traces show — retry trace
// ---------------------------------------------------------------------------

describe("warplane traces show (retry trace)", () => {
  it("shows retry info when present", async () => {
    // Find the retry trace
    const { stdout: listOut } = await run("--json traces list --status retry_success");
    const traces = JSON.parse(listOut).traces;
    if (traces.length === 0) return; // skip if no retry traces

    const retryId = traces[0].messageId;
    const { stdout, exitCode } = await run(`traces show ${retryId}`);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Retry gas");
    expect(stdout).toContain("Retry tx");
  });

  it("includes retry info in JSON output", async () => {
    const { stdout: listOut } = await run("--json traces list --status retry_success");
    const traces = JSON.parse(listOut).traces;
    if (traces.length === 0) return;

    const retryId = traces[0].messageId;
    const { stdout } = await run(`--json traces show ${retryId}`);
    const data = JSON.parse(stdout);
    expect(data.retry).toBeDefined();
    expect(data.retry.originalGasLimit).toBeDefined();
    expect(data.retry.retryGasLimit).toBeDefined();
    expect(data.retry.retryTxHash).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Traces show — relayer info
// ---------------------------------------------------------------------------

describe("warplane traces show (relayer info)", () => {
  it("shows relayer info when present", async () => {
    const { stdout: listOut } = await run("--json traces list -n 1");
    const id = JSON.parse(listOut).traces[0].messageId;
    const { stdout } = await run(`traces show ${id}`);
    expect(stdout).toContain("Relayer");
    expect(stdout).toContain("Relay tx");
  });
});

// ---------------------------------------------------------------------------
// Failures
// ---------------------------------------------------------------------------

describe("warplane failures list", () => {
  it("lists failures in JSON mode", async () => {
    const { stdout, exitCode } = await run("--json failures list");
    expect(exitCode).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.failures).toBeInstanceOf(Array);
    for (const f of data.failures) {
      expect(["failed", "replay_blocked", "pending"]).toContain(f.execution);
    }
  });

  it("lists failures in TTY mode", async () => {
    const { stdout, exitCode } = await run("failures list");
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Failures");
    expect(stdout).toContain("MESSAGE ID");
  });

  it("filters by scenario", async () => {
    const { stdout } = await run("--json failures list --scenario replay_or_duplicate_blocked");
    const data = JSON.parse(stdout);
    for (const f of data.failures) {
      expect(f.scenario).toContain("replay_or_duplicate_blocked");
    }
  });

  it("returns empty for scenario with no failures", async () => {
    const { stdout, exitCode } = await run("--json failures list --scenario basic_send_receive");
    expect(exitCode).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.failures).toEqual([]);
  });

  it("shows hint in TTY mode when there are failures", async () => {
    const { stdout } = await run("failures list");
    // The hint says "warplane traces show" if there are failures
    const data = await run("--json failures list");
    const failures = JSON.parse(data.stdout).failures;
    if (failures.length > 0) {
      expect(stdout).toContain("warplane traces show");
    }
  });
});

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

describe("warplane scenarios list", () => {
  it("lists scenarios in JSON mode with full shape", async () => {
    const { stdout, exitCode } = await run("--json scenarios list");
    expect(exitCode).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.scenarios).toBeInstanceOf(Array);
    expect(data.scenarios.length).toBeGreaterThan(0);
    const s = data.scenarios[0];
    expect(s).toHaveProperty("scenario");
    expect(s).toHaveProperty("passed");
    expect(s).toHaveProperty("startedAt");
    expect(s).toHaveProperty("completedAt");
    expect(s).toHaveProperty("messageIds");
  });

  it("lists scenarios in TTY mode with table headers", async () => {
    const { stdout, exitCode } = await run("scenarios list");
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Scenarios");
    expect(stdout).toContain("SCENARIO");
    expect(stdout).toContain("PASSED");
    expect(stdout).toContain("MESSAGES");
    expect(stdout).toContain("STARTED");
  });
});

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

describe("warplane registry show", () => {
  it("shows chains and networks in JSON mode", async () => {
    const { stdout, exitCode } = await run("--json registry show");
    expect(exitCode).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.chains).toBeInstanceOf(Array);
    expect(data.chains.length).toBeGreaterThan(0);
    expect(data.chains[0]).toHaveProperty("name");
    expect(data.chains[0]).toHaveProperty("blockchainId");
    expect(data.chains[0]).toHaveProperty("subnetId");
    expect(data.chains[0]).toHaveProperty("evmChainId");
    expect(data.networks).toBeInstanceOf(Array);
    expect(data.networks.length).toBeGreaterThan(0);
    expect(data.networks[0]).toHaveProperty("networkId");
    expect(data.networks[0]).toHaveProperty("source");
    expect(data.networks[0]).toHaveProperty("destination");
  });

  it("shows registry in TTY mode with both tables", async () => {
    const { stdout, exitCode } = await run("registry show");
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Chains");
    expect(stdout).toContain("NAME");
    expect(stdout).toContain("BLOCKCHAIN ID");
    expect(stdout).toContain("Networks");
    expect(stdout).toContain("NETWORK ID");
    expect(stdout).toContain("TELEPORTER");
  });
});

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

describe("warplane import", () => {
  it("imports golden fixtures via API (JSON)", async () => {
    const { stdout, exitCode } = await run("--json import harness/tmpnet/artifacts");
    expect(exitCode).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.importId).toBeGreaterThan(0);
    expect(typeof data.traces).toBe("number");
    expect(typeof data.networks).toBe("number");
    expect(typeof data.chains).toBe("number");
    expect(typeof data.scenarios).toBe("number");
    expect(data.errors).toBeInstanceOf(Array);
  });

  it("imports in TTY mode with summary", async () => {
    const { stdout, exitCode } = await run("import harness/tmpnet/artifacts");
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Import complete");
    expect(stdout).toContain("Import ID");
    expect(stdout).toContain("Traces");
  });

  it("accepts --source-type option", async () => {
    const { stdout, exitCode } = await run(
      "--json import harness/tmpnet/artifacts --source-type ci-test",
    );
    expect(exitCode).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.importId).toBeGreaterThan(0);
  });

  it("fails for missing directory", async () => {
    const { exitCode } = await run("--json import /nonexistent/path");
    expect(exitCode).toBe(1);
  });

  it("shows error message for missing directory", async () => {
    const { stdout, stderr, exitCode } = await run("import /nonexistent/path");
    expect(exitCode).toBe(1);
    const combined = stdout + stderr;
    expect(combined.length).toBeGreaterThan(0); // Some error output
  });
});

// ---------------------------------------------------------------------------
// Demo seed
// ---------------------------------------------------------------------------

describe("warplane demo seed", () => {
  it("seeds data via API (JSON)", async () => {
    const { stdout, exitCode } = await run("--json demo seed");
    expect(exitCode).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.importId).toBeGreaterThan(0);
    expect(typeof data.traces).toBe("number");
  });

  it("seeds data in TTY mode", async () => {
    const { stdout, exitCode } = await run("demo seed");
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Demo data seeded");
    expect(stdout).toContain("Traces");
  });

  it("shows error when API is not reachable", async () => {
    const { stdout, stderr, exitCode } = await run("demo seed", {
      ICP_API_URL: "http://localhost:19999",
    });
    expect(exitCode).toBe(1);
    const combined = stdout + stderr;
    expect(combined).toContain("not running");
  });

  it("shows JSON error when API is not reachable in JSON mode", async () => {
    const { stdout, exitCode } = await run("--json demo seed", {
      ICP_API_URL: "http://localhost:19999",
    });
    expect(exitCode).toBe(1);
    const data = JSON.parse(stdout);
    expect(data.error).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Completion
// ---------------------------------------------------------------------------

describe("warplane completion", () => {
  it("outputs bash completion with all subcommands", async () => {
    const { stdout, exitCode } = await run("completion bash");
    expect(exitCode).toBe(0);
    expect(stdout).toContain("_warplane_completions");
    expect(stdout).toContain("complete -F");
    expect(stdout).toContain("doctor");
    expect(stdout).toContain("traces");
    expect(stdout).toContain("demo");
  });

  it("outputs zsh completion", async () => {
    const { stdout, exitCode } = await run("completion zsh");
    expect(exitCode).toBe(0);
    expect(stdout).toContain("compdef _warplane");
    expect(stdout).toContain("commands=(");
  });

  it("outputs fish completion", async () => {
    const { stdout, exitCode } = await run("completion fish");
    expect(exitCode).toBe(0);
    expect(stdout).toContain("complete -c warplane");
    expect(stdout).toContain("__fish_use_subcommand");
  });

  it("defaults to bash when no shell specified", async () => {
    const { stdout, exitCode } = await run("completion");
    expect(exitCode).toBe(0);
    expect(stdout).toContain("_warplane_completions");
  });
});

// ---------------------------------------------------------------------------
// Docs MCP
// ---------------------------------------------------------------------------

describe("warplane docs mcp --check", () => {
  it("checks MCP server build status (JSON)", async () => {
    const { stdout, exitCode } = await run("--json docs mcp --check");
    expect(exitCode).toBe(0);
    const data = JSON.parse(stdout);
    expect(typeof data.built).toBe("boolean");
    expect(data.path).toContain("docs-mcp");
  });

  it("checks MCP server build status (TTY)", async () => {
    const { stdout, exitCode } = await run("docs mcp --check");
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Docs MCP server");
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe("API unreachable", () => {
  it("shows helpful message when API is down (TTY)", async () => {
    const { stdout, stderr, exitCode } = await run("traces list", {
      ICP_API_URL: "http://localhost:19999",
    });
    expect(exitCode).toBe(1);
    const combined = stdout + stderr;
    expect(combined).toContain("Cannot reach the API");
    expect(combined).toContain("pnpm dev");
  });

  it("shows helpful message when API is down (JSON mode)", async () => {
    const { stdout, stderr, exitCode } = await run("--json traces list", {
      ICP_API_URL: "http://localhost:19999",
    });
    expect(exitCode).toBe(1);
    const combined = stdout + stderr;
    expect(combined).toContain("Cannot reach the API");
  });

  it("shows error for failures list when API is down", async () => {
    const { stdout, stderr, exitCode } = await run("failures list", {
      ICP_API_URL: "http://localhost:19999",
    });
    expect(exitCode).toBe(1);
    const combined = stdout + stderr;
    expect(combined).toContain("Cannot reach the API");
  });

  it("shows error for scenarios list when API is down", async () => {
    const { stdout, stderr, exitCode } = await run("scenarios list", {
      ICP_API_URL: "http://localhost:19999",
    });
    expect(exitCode).toBe(1);
    const combined = stdout + stderr;
    expect(combined).toContain("Cannot reach the API");
  });

  it("shows error for registry show when API is down", async () => {
    const { stdout, stderr, exitCode } = await run("registry show", {
      ICP_API_URL: "http://localhost:19999",
    });
    expect(exitCode).toBe(1);
    const combined = stdout + stderr;
    expect(combined).toContain("Cannot reach the API");
  });
});

// ---------------------------------------------------------------------------
// Subcommand help
// ---------------------------------------------------------------------------

describe("subcommand help", () => {
  it("traces --help shows subcommands", async () => {
    const { stdout, exitCode } = await run("traces --help");
    expect(exitCode).toBe(0);
    expect(stdout).toContain("list");
    expect(stdout).toContain("show");
  });

  it("demo --help shows subcommands", async () => {
    const { stdout, exitCode } = await run("demo --help");
    expect(exitCode).toBe(0);
    expect(stdout).toContain("seed");
    expect(stdout).toContain("start");
  });

  it("failures --help shows subcommands", async () => {
    const { stdout, exitCode } = await run("failures --help");
    expect(exitCode).toBe(0);
    expect(stdout).toContain("list");
  });

  it("registry --help shows subcommands", async () => {
    const { stdout, exitCode } = await run("registry --help");
    expect(exitCode).toBe(0);
    expect(stdout).toContain("show");
  });

  it("docs --help shows subcommands", async () => {
    const { stdout, exitCode } = await run("docs --help");
    expect(exitCode).toBe(0);
    expect(stdout).toContain("mcp");
  });
});
