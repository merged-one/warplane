import { describe, it, expect, vi } from "vitest";
import { fetchTeleporterEvents } from "./fetcher.js";
import type { RpcClient } from "./client.js";
import { TELEPORTER_MESSENGER_ADDRESS } from "./abi.js";
import { encodeEventTopics } from "viem";
import { teleporterMessengerAbi } from "./abi.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MSG_ID = "0x0000000000000000000000000000000000000000000000000000000000000001";
const CHAIN_ID = "0x0000000000000000000000000000000000000000000000000000000000000002";

/** Create a fake viem Log that decodes as MessageExecuted. */
function fakeLog(blockNumber: bigint, logIndex = 0) {
  const topics = encodeEventTopics({
    abi: teleporterMessengerAbi,
    eventName: "MessageExecuted",
    args: {
      messageID: MSG_ID as `0x${string}`,
      sourceBlockchainID: CHAIN_ID as `0x${string}`,
    },
  });

  return {
    address: TELEPORTER_MESSENGER_ADDRESS,
    topics: topics as readonly string[],
    data: "0x" as const,
    blockNumber,
    transactionHash: `0xtx${blockNumber}`,
    logIndex,
    blockHash: `0xblock${blockNumber}`,
    removed: false,
    transactionIndex: 0,
  };
}

function mockClient(getLogsFn: RpcClient["getLogs"]): RpcClient {
  return {
    name: "mock",
    getBlockNumber: vi.fn(),
    getBlockHeader: vi.fn().mockImplementation(async (blockNumber: bigint) => ({
      number: blockNumber,
      hash: `0xblock${blockNumber}`,
      parentHash: `0xblock${blockNumber - 1n}`,
      timestamp: blockNumber + 1_700_000_000n,
    })),
    getLogs: getLogsFn,
    watchBlocks: vi.fn(),
    isHealthy: vi.fn(),
    destroy: vi.fn(),
  } as unknown as RpcClient;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("fetchTeleporterEvents", () => {
  it("fetches a single range when within maxBlockRange", async () => {
    const getLogs = vi.fn().mockResolvedValue([fakeLog(10n)]);
    const client = mockClient(getLogs);

    const result = await fetchTeleporterEvents(client, 1n, 50n, {
      maxBlockRange: 100,
    });

    expect(getLogs).toHaveBeenCalledOnce();
    expect(getLogs).toHaveBeenCalledWith({
      address: TELEPORTER_MESSENGER_ADDRESS,
      fromBlock: 1n,
      toBlock: 50n,
    });
    expect(result.events).toHaveLength(1);
    expect(result.events[0]!.eventName).toBe("MessageExecuted");
  });

  it("paginates across multiple chunks", async () => {
    const getLogs = vi.fn().mockResolvedValue([]);
    const client = mockClient(getLogs);

    await fetchTeleporterEvents(client, 0n, 250n, { maxBlockRange: 100 });

    // 0-99, 100-199, 200-250 = 3 calls
    expect(getLogs).toHaveBeenCalledTimes(3);
    expect(getLogs).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ fromBlock: 0n, toBlock: 99n }),
    );
    expect(getLogs).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ fromBlock: 100n, toBlock: 199n }),
    );
    expect(getLogs).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ fromBlock: 200n, toBlock: 250n }),
    );
  });

  it("bisects on oversized response error", async () => {
    const getLogs = vi
      .fn()
      .mockImplementation(async (params: { fromBlock: bigint; toBlock: bigint }) => {
        // First call (full range) fails, subsequent bisected calls succeed
        if (params.fromBlock === 0n && params.toBlock === 9n) {
          throw new Error("query returned more than 10000 results");
        }
        return [fakeLog(params.fromBlock)];
      });

    const client = mockClient(getLogs);
    const result = await fetchTeleporterEvents(client, 0n, 9n, {
      maxBlockRange: 100_000,
    });

    // 1 initial fail + 2 bisected calls
    expect(getLogs).toHaveBeenCalledTimes(3);
    expect(result.events).toHaveLength(2);
  });

  it("bisects on Avalanche max block range errors", async () => {
    const getLogs = vi
      .fn()
      .mockImplementation(async (params: { fromBlock: bigint; toBlock: bigint }) => {
        if (params.fromBlock === 0n && params.toBlock === 4095n) {
          throw new Error("requested too many blocks from 0 to 4095, maximum is set to 2048");
        }
        return [fakeLog(params.fromBlock)];
      });

    const client = mockClient(getLogs);
    const result = await fetchTeleporterEvents(client, 0n, 4095n, {
      maxBlockRange: 10_000,
    });

    expect(getLogs).toHaveBeenCalledTimes(3);
    expect(result.events).toHaveLength(2);
  });

  it("combines events from paginated chunks in order", async () => {
    const getLogs = vi.fn().mockImplementation(async (params: { fromBlock: bigint }) => {
      return [fakeLog(params.fromBlock)];
    });
    const client = mockClient(getLogs);

    const result = await fetchTeleporterEvents(client, 0n, 150n, {
      maxBlockRange: 100,
    });

    expect(result.events).toHaveLength(2);
    expect(result.events[0]!.blockNumber).toBe(0n);
    expect(result.events[1]!.blockNumber).toBe(100n);
  });

  it("enriches decoded events with block timestamps per unique block", async () => {
    const getLogs = vi.fn().mockResolvedValue([fakeLog(10n, 0), fakeLog(10n, 1), fakeLog(11n, 0)]);
    const client = mockClient(getLogs);

    const result = await fetchTeleporterEvents(client, 10n, 11n);

    expect(client.getBlockHeader).toHaveBeenCalledTimes(2);
    expect(result.events[0]!.blockTimestamp).toBe(1_700_000_010n);
    expect(result.events[1]!.blockTimestamp).toBe(1_700_000_010n);
    expect(result.events[2]!.blockTimestamp).toBe(1_700_000_011n);
  });

  it("returns empty events for a range with no logs", async () => {
    const getLogs = vi.fn().mockResolvedValue([]);
    const client = mockClient(getLogs);

    const result = await fetchTeleporterEvents(client, 100n, 200n);
    expect(result.events).toHaveLength(0);
    expect(result.fromBlock).toBe(100n);
    expect(result.toBlock).toBe(200n);
  });

  it("uses default maxBlockRange of 100,000", async () => {
    const getLogs = vi.fn().mockResolvedValue([]);
    const client = mockClient(getLogs);

    await fetchTeleporterEvents(client, 0n, 99_999n);
    expect(getLogs).toHaveBeenCalledOnce();

    getLogs.mockClear();
    await fetchTeleporterEvents(client, 0n, 100_000n);
    // 0-99999, 100000-100000 = 2 calls
    expect(getLogs).toHaveBeenCalledTimes(2);
  });

  it("propagates non-size errors", async () => {
    const getLogs = vi.fn().mockRejectedValue(new Error("RPC node unreachable"));
    const client = mockClient(getLogs);

    await expect(fetchTeleporterEvents(client, 0n, 10n)).rejects.toThrow("RPC node unreachable");
  });

  it("uses custom contractAddress from config", async () => {
    const getLogs = vi.fn().mockResolvedValue([]);
    const client = mockClient(getLogs);
    const custom = "0x1111111111111111111111111111111111111111";

    await fetchTeleporterEvents(client, 0n, 10n, {
      contractAddress: custom,
    });

    expect(getLogs).toHaveBeenCalledWith(expect.objectContaining({ address: custom }));
  });

  it("handles single-block range", async () => {
    const getLogs = vi.fn().mockResolvedValue([fakeLog(42n)]);
    const client = mockClient(getLogs);

    const result = await fetchTeleporterEvents(client, 42n, 42n);
    expect(getLogs).toHaveBeenCalledOnce();
    expect(result.events).toHaveLength(1);
  });

  it("decodes only Teleporter events, skipping non-matching logs", async () => {
    const nonTeleporterLog = {
      address: "0x0000000000000000000000000000000000000000",
      topics: [
        "0xdeadbeef00000000000000000000000000000000000000000000000000000000",
      ] as readonly string[],
      data: "0x" as const,
      blockNumber: 1n,
      transactionHash: "0xtx1",
      logIndex: 0,
      blockHash: "0xblock1",
      removed: false,
      transactionIndex: 0,
    };

    const getLogs = vi.fn().mockResolvedValue([fakeLog(1n), nonTeleporterLog]);
    const client = mockClient(getLogs);

    const result = await fetchTeleporterEvents(client, 1n, 1n);
    // Only the Teleporter log should be decoded
    expect(result.events).toHaveLength(1);
    expect(result.events[0]!.eventName).toBe("MessageExecuted");
  });
});
