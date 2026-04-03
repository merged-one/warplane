import { describe, it, expect, afterEach, vi } from "vitest";
import fs from "node:fs";
import { loadConfig } from "./config.js";

describe("loadConfig", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("loads valid YAML config file", () => {
    const yamlContent = `
chains:
  - name: "Fuji C-Chain"
    blockchainId: "yH8D7ThNJkxmtkuv2jgBa4P1Rn3Qpr4pPr7QYNfcdoS6k6HWp"
    evmChainId: 43113
    rpcUrl: "https://api.avax-test.network/ext/bc/C/rpc"
    teleporterAddress: "0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf"

relayer:
  metricsUrl: "http://relayer:9090/metrics"

sigagg:
  metricsUrl: "http://sigagg:8081/metrics"

logLevel: "debug"
`;
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readFileSync").mockReturnValue(yamlContent);

    const config = loadConfig("/some/config.yaml");

    expect(config.chains).toHaveLength(1);
    expect(config.chains[0]!.name).toBe("Fuji C-Chain");
    expect(config.chains[0]!.evmChainId).toBe(43113);
    expect(config.relayer?.metricsUrl).toBe("http://relayer:9090/metrics");
    expect(config.sigagg?.metricsUrl).toBe("http://sigagg:8081/metrics");
    expect(config.logLevel).toBe("debug");
  });

  it("env vars override YAML values", () => {
    const yamlContent = `
chains:
  - name: "From YAML"
    blockchainId: "abc"
    rpcUrl: "http://yaml-rpc"
    teleporterAddress: "0x123"

relayer:
  metricsUrl: "http://yaml-relayer/metrics"
`;
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readFileSync").mockReturnValue(yamlContent);

    process.env["WARPLANE_RELAYER_METRICS_URL"] = "http://env-relayer/metrics";
    process.env["DB_PATH"] = "/data/override.db";

    const config = loadConfig("/some/config.yaml");

    // Chains from YAML (not overridden)
    expect(config.chains).toHaveLength(1);
    expect(config.chains[0]!.name).toBe("From YAML");

    // Relayer overridden by env
    expect(config.relayer?.metricsUrl).toBe("http://env-relayer/metrics");

    // DB path from env
    expect(config.database?.path).toBe("/data/override.db");
  });

  it("returns empty chains when no config file exists", () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(false);
    delete process.env["WARPLANE_CONFIG"];
    delete process.env["WARPLANE_CHAINS"];

    const config = loadConfig();

    expect(config.chains).toEqual([]);
    expect(config.relayer).toBeUndefined();
    expect(config.sigagg).toBeUndefined();
  });
});
