import { createHash } from "node:crypto";
import type { ChainMeta } from "@warplane/domain";
import type { ChainRegistry } from "./types.js";

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE58_INDEX = new Map([...BASE58_ALPHABET].map((char, index) => [char, index] as const));
const RAW_BLOCKCHAIN_ID = /^0x[0-9a-fA-F]{64}$/;

export interface ChainResolver {
  canonicalizeBlockchainId(blockchainId: string): string;
  getChainMeta(blockchainId: string): ChainMeta | undefined;
}

export function createChainResolver(chainRegistry?: ChainRegistry): ChainResolver {
  const aliases = new Map<string, string>();
  const chainMeta = new Map<string, ChainMeta>();

  for (const meta of chainRegistry?.values() ?? []) {
    chainMeta.set(meta.blockchainId, meta);
    registerAlias(aliases, meta.blockchainId, meta.blockchainId);

    const rawId = toRawBlockchainId(meta.blockchainId);
    if (rawId) {
      registerAlias(aliases, rawId, meta.blockchainId);
    }
  }

  function canonicalizeBlockchainId(blockchainId: string): string {
    if (!blockchainId) return blockchainId;
    return aliases.get(normalizeAlias(blockchainId)) ?? blockchainId;
  }

  function getChainMeta(blockchainId: string): ChainMeta | undefined {
    return chainMeta.get(canonicalizeBlockchainId(blockchainId));
  }

  return {
    canonicalizeBlockchainId,
    getChainMeta,
  };
}

export function cloneChainMeta(meta: ChainMeta): ChainMeta {
  return { ...meta };
}

export function isRawBlockchainId(blockchainId: string): boolean {
  return RAW_BLOCKCHAIN_ID.test(blockchainId);
}

function registerAlias(aliases: Map<string, string>, alias: string, canonical: string): void {
  aliases.set(normalizeAlias(alias), canonical);
}

function normalizeAlias(blockchainId: string): string {
  return isRawBlockchainId(blockchainId) ? blockchainId.toLowerCase() : blockchainId;
}

function toRawBlockchainId(blockchainId: string): string | undefined {
  if (!blockchainId) return undefined;
  if (isRawBlockchainId(blockchainId)) return blockchainId.toLowerCase();

  const decoded = decodeBase58(blockchainId);
  if (!decoded || decoded.length <= 4) return undefined;

  const payload = decoded.subarray(0, decoded.length - 4);
  const checksum = decoded.subarray(decoded.length - 4);
  const expectedChecksum = sha256(payload).subarray(-4);

  if (!equalBytes(checksum, expectedChecksum)) {
    return undefined;
  }

  return `0x${Buffer.from(payload).toString("hex")}`;
}

function decodeBase58(value: string): Uint8Array | undefined {
  if (!value) return undefined;

  let acc = 0n;
  for (const char of value) {
    const digit = BASE58_INDEX.get(char);
    if (digit === undefined) return undefined;
    acc = acc * 58n + BigInt(digit);
  }

  const bytes: number[] = [];
  while (acc > 0n) {
    bytes.push(Number(acc % 256n));
    acc /= 256n;
  }
  bytes.reverse();

  const leadingZeroes = value.match(/^1+/)?.[0].length ?? 0;
  return Uint8Array.from([...new Array<number>(leadingZeroes).fill(0), ...bytes]);
}

function sha256(value: Uint8Array): Buffer {
  return createHash("sha256").update(value).digest();
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i++) {
    if (left[i] !== right[i]) return false;
  }
  return true;
}
