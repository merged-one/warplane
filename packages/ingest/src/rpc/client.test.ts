import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock viem before importing client
// ---------------------------------------------------------------------------

const mockGetBlockNumber = vi.fn();
const mockGetBlock = vi.fn();
const mockGetLogs = vi.fn();
const mockWatchBlockNumber = vi.fn();

const mockHttpClient = {
  getBlockNumber: mockGetBlockNumber,
  getBlock: mockGetBlock,
  getLogs: mockGetLogs,
  watchBlockNumber: mockWatchBlockNumber,
  transport: { value: {} },
};

const mockWsClose = vi.fn();
const mockWsClient = {
  getBlockNumber: vi.fn(),
  getBlock: vi.fn(),
  getLogs: vi.fn(),
  watchBlockNumber: mockWatchBlockNumber,
  transport: { value: { close: mockWsClose } },
};

let clientCount = 0;

vi.mock("viem", () => ({
  createPublicClient: vi.fn(() => {
    clientCount++;
    // First call = HTTP, second call = WS (if wsUrl provided)
    return clientCount % 2 === 1 ? mockHttpClient : mockWsClient;
  }),
  http: vi.fn((url: string) => `http-transport:${url}`),
  webSocket: vi.fn((url: string) => `ws-transport:${url}`),
}));

import { createRpcClient, type RpcClient } from "./client.js";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("RpcClient", () => {
  let client: RpcClient;

  beforeEach(() => {
    vi.clearAllMocks();
    clientCount = 0;
    client = createRpcClient({
      name: "test-chain",
      rpcUrl: "https://rpc.test.network",
      maxRetries: 1,
      baseRetryDelayMs: 10,
    });
  });

  it("creates with the configured name", () => {
    expect(client.name).toBe("test-chain");
  });

  it("getBlockNumber returns the block number from the HTTP client", async () => {
    mockGetBlockNumber.mockResolvedValueOnce(42n);
    const result = await client.getBlockNumber();
    expect(result).toBe(42n);
    expect(mockGetBlockNumber).toHaveBeenCalledOnce();
  });

  it("getBlockNumber retries on failure then succeeds", async () => {
    mockGetBlockNumber.mockRejectedValueOnce(new Error("timeout")).mockResolvedValueOnce(100n);

    const result = await client.getBlockNumber();
    expect(result).toBe(100n);
    expect(mockGetBlockNumber).toHaveBeenCalledTimes(2);
  });

  it("getBlockNumber throws after exhausting retries", async () => {
    mockGetBlockNumber.mockRejectedValue(new Error("down"));
    await expect(client.getBlockNumber()).rejects.toThrow("down");
    // 1 initial + 1 retry = 2 calls
    expect(mockGetBlockNumber).toHaveBeenCalledTimes(2);
  });

  it("getBlockHeader returns a BlockHeader shape", async () => {
    mockGetBlock.mockResolvedValueOnce({
      number: 50n,
      hash: "0xblock50",
      parentHash: "0xblock49",
      timestamp: 1000n,
    });

    const header = await client.getBlockHeader(50n);
    expect(header).toEqual({
      number: 50n,
      hash: "0xblock50",
      parentHash: "0xblock49",
      timestamp: 1000n,
    });
    expect(mockGetBlock).toHaveBeenCalledWith({ blockNumber: 50n });
  });

  it("getLogs passes correct parameters and returns logs", async () => {
    const fakeLogs = [{ logIndex: 0 }, { logIndex: 1 }];
    mockGetLogs.mockResolvedValueOnce(fakeLogs);

    const result = await client.getLogs({
      address: "0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf",
      fromBlock: 100n,
      toBlock: 200n,
    });

    expect(result).toEqual(fakeLogs);
    expect(mockGetLogs).toHaveBeenCalledWith({
      address: "0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf",
      fromBlock: 100n,
      toBlock: 200n,
      topics: undefined,
    });
  });

  it("getLogs retries on transient errors", async () => {
    mockGetLogs.mockRejectedValueOnce(new Error("rate limited")).mockResolvedValueOnce([]);

    const result = await client.getLogs({
      address: "0x1234567890123456789012345678901234567890",
      fromBlock: 0n,
      toBlock: 10n,
    });

    expect(result).toEqual([]);
    expect(mockGetLogs).toHaveBeenCalledTimes(2);
  });

  it("watchBlocks calls watchBlockNumber on the HTTP client (polling mode)", () => {
    const unsub = vi.fn();
    mockWatchBlockNumber.mockReturnValueOnce(unsub);
    const onBlock = vi.fn();

    const result = client.watchBlocks(onBlock);
    expect(result).toBe(unsub);
    expect(mockWatchBlockNumber).toHaveBeenCalledWith({
      onBlockNumber: onBlock,
      poll: true,
      pollingInterval: 2_000,
    });
  });

  it("isHealthy returns true when getBlockNumber succeeds", async () => {
    mockGetBlockNumber.mockResolvedValueOnce(1n);
    expect(await client.isHealthy()).toBe(true);
  });

  it("isHealthy returns false when getBlockNumber fails", async () => {
    mockGetBlockNumber.mockRejectedValueOnce(new Error("unreachable"));
    expect(await client.isHealthy()).toBe(false);
  });

  it("destroy can be called without errors", async () => {
    await expect(client.destroy()).resolves.toBeUndefined();
  });

  it("destroy is idempotent — second call is a no-op", async () => {
    await client.destroy();
    await expect(client.destroy()).resolves.toBeUndefined();
  });
});
