/**
 * Configuration loader — reads chain config from YAML files and environment variables.
 *
 * Loading precedence:
 * 1. WARPLANE_CONFIG env var → path to YAML file
 * 2. config/warplane.yaml (default, optional)
 * 3. Individual env vars override YAML values
 */

import fs from "node:fs";
import yaml from "js-yaml";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChainYaml {
  name: string;
  blockchainId: string;
  evmChainId?: number;
  rpcUrl: string;
  wsUrl?: string;
  teleporterAddress: string;
  startBlock?: number;
}

export interface WarplaneConfig {
  chains: ChainYaml[];
  relayer?: { metricsUrl: string };
  sigagg?: { metricsUrl: string };
  database?: { path: string };
  port?: number;
  logLevel?: string;
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export function loadConfig(configPath?: string): WarplaneConfig {
  const config: WarplaneConfig = { chains: [] };

  // 1. Try to load YAML config file
  const yamlPath = configPath ?? process.env["WARPLANE_CONFIG"] ?? "config/warplane.yaml";

  if (fs.existsSync(yamlPath)) {
    const raw = fs.readFileSync(yamlPath, "utf-8");
    const parsed = yaml.load(raw) as Record<string, unknown> | null;

    if (parsed && typeof parsed === "object") {
      if (Array.isArray(parsed.chains)) {
        config.chains = parsed.chains as ChainYaml[];
      }
      if (parsed.relayer && typeof parsed.relayer === "object") {
        const r = parsed.relayer as Record<string, unknown>;
        if (r.metricsUrl) config.relayer = { metricsUrl: String(r.metricsUrl) };
      }
      if (parsed.sigagg && typeof parsed.sigagg === "object") {
        const s = parsed.sigagg as Record<string, unknown>;
        if (s.metricsUrl) config.sigagg = { metricsUrl: String(s.metricsUrl) };
      }
      if (parsed.database && typeof parsed.database === "object") {
        const d = parsed.database as Record<string, unknown>;
        if (d.path) config.database = { path: String(d.path) };
      }
      if (typeof parsed.port === "number") config.port = parsed.port;
      if (typeof parsed.logLevel === "string") config.logLevel = parsed.logLevel;
    }
  }

  // 2. Environment variable overrides
  const envChains = process.env["WARPLANE_CHAINS"];
  if (envChains) {
    try {
      config.chains = JSON.parse(envChains) as ChainYaml[];
    } catch {
      // Invalid JSON — keep YAML chains
    }
  }

  const envRelayer = process.env["WARPLANE_RELAYER_METRICS_URL"];
  if (envRelayer) config.relayer = { metricsUrl: envRelayer };

  const envSigagg = process.env["WARPLANE_SIGAGG_METRICS_URL"];
  if (envSigagg) config.sigagg = { metricsUrl: envSigagg };

  const envDbPath = process.env["DB_PATH"];
  if (envDbPath) config.database = { path: envDbPath };

  const envLogLevel = process.env["WARPLANE_LOG_LEVEL"];
  if (envLogLevel) config.logLevel = envLogLevel;

  return config;
}
