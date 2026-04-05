import { describe, expect, it } from "vitest";
import { createChainResolver } from "./chain-resolver.js";
import type { ChainRegistry } from "./types.js";

const CXCHAIN = "25xjR3fvh7aXkxs36n1xRc3wLUAuqnS1wBxJD1BC4z3y6mHsEV";
const CXCHAIN_RAW = "0x8ef5dc1c38fc403fe671cdc1f2304d4a74b6bc5350d18a0fdb9d644d777e8b9c";
const HENESYS = "2LFmzhHDKxkreihEtPanVmofuFn63bsh8twnRXEbDhBtCJxURB";
const HENESYS_RAW = "0xaf6a974f467006d94388f438014162dd12ec2d1475c48faf09ffe7222d59e478";

const CHAIN_REGISTRY: ChainRegistry = new Map([
  [
    CXCHAIN,
    {
      name: "CXChain",
      blockchainId: CXCHAIN,
      subnetId: "",
      evmChainId: 737373,
    },
  ],
  [
    HENESYS,
    {
      name: "Henesys",
      blockchainId: HENESYS,
      subnetId: "",
      evmChainId: 68414,
    },
  ],
]);

describe("createChainResolver", () => {
  it("canonicalizes official Avalanche raw blockchain IDs", () => {
    const resolver = createChainResolver(CHAIN_REGISTRY);

    expect(resolver.canonicalizeBlockchainId(CXCHAIN_RAW)).toBe(CXCHAIN);
    expect(resolver.canonicalizeBlockchainId(HENESYS_RAW)).toBe(HENESYS);
  });

  it("returns chain metadata for raw blockchain IDs", () => {
    const resolver = createChainResolver(CHAIN_REGISTRY);

    expect(resolver.getChainMeta(CXCHAIN_RAW)?.name).toBe("CXChain");
    expect(resolver.getChainMeta(HENESYS_RAW)?.name).toBe("Henesys");
  });
});
