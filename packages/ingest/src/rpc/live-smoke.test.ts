/**
 * Live-network smoke tests for Avalanche RPC connectivity.
 *
 * These tests hit real Avalanche endpoints (Fuji testnet + Mainnet)
 * to verify the RPC client and event fetcher work against live chain data.
 *
 * Gated by RUN_LIVE_SMOKE — never runs during regular `pnpm test`.
 *
 * Usage:
 *   RUN_LIVE_SMOKE=1 pnpm vitest run packages/ingest/src/rpc/live-smoke.test.ts
 *
 * Override RPC URLs with env vars:
 *   FUJI_RPC_URL=https://your-provider/fuji
 *   MAINNET_RPC_URL=https://your-provider/mainnet
 */

import { describe, it, expect, afterAll } from "vitest";
import { createRpcClient, type RpcClient } from "./client.js";
import { fetchTeleporterEvents } from "./fetcher.js";
import { TELEPORTER_MESSENGER_ADDRESS } from "./abi.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const FUJI_RPC = process.env["FUJI_RPC_URL"] ?? "https://api.avax-test.network/ext/bc/C/rpc";
const MAINNET_RPC = process.env["MAINNET_RPC_URL"] ?? "https://api.avax.network/ext/bc/C/rpc";

const CLIENT_OPTS = { maxRetries: 2, baseRetryDelayMs: 500 };

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function createChainTests(name: string, rpcUrl: string) {
  describe(name, { timeout: 15_000 }, () => {
    let client: RpcClient;

    afterAll(async () => {
      if (client) await client.destroy();
    });

    it("isHealthy() returns true", async () => {
      client = createRpcClient({ name, rpcUrl, ...CLIENT_OPTS });
      expect(await client.isHealthy()).toBe(true);
    });

    it("getBlockNumber() returns a positive block", async () => {
      const block = await client.getBlockNumber();
      expect(block).toBeGreaterThan(0n);
    });

    it("fetchTeleporterEvents() succeeds on a 50-block range from tip", async () => {
      const tip = await client.getBlockNumber();
      const from = tip - 50n > 0n ? tip - 50n : 0n;

      const result = await fetchTeleporterEvents(client, from, tip, {
        contractAddress: TELEPORTER_MESSENGER_ADDRESS,
      });

      // We don't assert specific event counts — Teleporter events may or
      // may not exist in any given 50-block window. We just verify the
      // fetcher completes without error and returns the right shape.
      expect(result).toHaveProperty("events");
      expect(result).toHaveProperty("fromBlock");
      expect(result).toHaveProperty("toBlock");
      expect(Array.isArray(result.events)).toBe(true);
      expect(result.toBlock).toBe(tip);
    });
  });
}

// ---------------------------------------------------------------------------
// Test suites — only run when RUN_LIVE_SMOKE is set
// ---------------------------------------------------------------------------

describe.skipIf(!process.env["RUN_LIVE_SMOKE"])("Live Network Smoke Tests", () => {
  createChainTests("Fuji C-Chain (43113)", FUJI_RPC);
  createChainTests("Mainnet C-Chain (43114)", MAINNET_RPC);
});
