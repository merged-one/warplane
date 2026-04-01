#!/usr/bin/env node

import { chainId } from "@warplane/domain";

const args = process.argv.slice(2);

if (args[0] === "ping") {
  const id = chainId(args[1] ?? "default-chain");
  console.log(`warplane: pinging chain ${id.blockchainId}`);
} else {
  console.log("warplane CLI — Interchain Control Plane for Avalanche L1s");
  console.log("Usage: warplane ping <chain-id>");
}
