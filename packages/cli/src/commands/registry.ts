/**
 * `warplane registry show` — show the chain and network registry.
 */

import { Command } from "commander";
import { ApiClient } from "../api-client.js";
import { isJsonMode, printJson, heading, table, shortId } from "../output.js";

export function registryCommand(): Command {
  const registry = new Command("registry").description("Inspect the chain and network registry");

  registry
    .command("show")
    .description("Show registered chains and networks")
    .action(async () => {
      const client = new ApiClient();

      const [chainsRes, networksRes] = await Promise.all([
        client.get<{
          chains: Array<{
            name: string;
            blockchainId: string;
            subnetId: string;
            evmChainId: number;
            rpcUrl?: string;
            teleporterAddress?: string;
          }>;
        }>("/api/v1/chains"),
        client.get<{
          networks: Array<{
            networkId: number;
            source: { name: string };
            destination: { name: string };
            teleporterVersion?: string;
          }>;
        }>("/api/v1/network"),
      ]);

      if (isJsonMode()) {
        printJson({ chains: chainsRes.chains, networks: networksRes.networks });
        return;
      }

      heading(`Chains (${chainsRes.chains.length})`);
      table(
        ["NAME", "BLOCKCHAIN ID", "SUBNET ID", "EVM CHAIN ID", "RPC"],
        chainsRes.chains.map((c) => [
          c.name,
          shortId(c.blockchainId),
          shortId(c.subnetId),
          String(c.evmChainId),
          c.rpcUrl ?? "—",
        ]),
      );

      heading(`Networks (${networksRes.networks.length})`);
      table(
        ["NETWORK ID", "SOURCE", "DESTINATION", "TELEPORTER"],
        networksRes.networks.map((n) => [
          String(n.networkId),
          n.source.name,
          n.destination.name,
          n.teleporterVersion ?? "—",
        ]),
      );
    });

  return registry;
}
