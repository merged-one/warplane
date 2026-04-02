import { describe, it, expect } from "vitest";
import { encodeEventTopics, encodeAbiParameters } from "viem";
import { teleporterMessengerAbi, TELEPORTER_MESSENGER_ADDRESS } from "./abi.js";
import { decodeTeleporterLog, decodeTeleporterLogs, type RawLog } from "./decoder.js";

// ---------------------------------------------------------------------------
// Helpers to build realistic raw logs from the ABI
// ---------------------------------------------------------------------------

const MSG_ID = "0x0000000000000000000000000000000000000000000000000000000000000001";
const CHAIN_ID = "0x0000000000000000000000000000000000000000000000000000000000000002";
const ADDR = "0x000000000000000000000000000000000000000A";
const ADDR2 = "0x000000000000000000000000000000000000000b";

function baseMeta(): Omit<RawLog, "address" | "topics" | "data"> {
  return {
    blockNumber: 100n,
    transactionHash: "0xabc123",
    logIndex: 0,
    blockHash: "0xblockhash",
    removed: false,
  };
}

/** Encode a TeleporterFeeInfo tuple. */
function encodeFeeInfo(feeTokenAddress: string, amount: bigint): `0x${string}` {
  return encodeAbiParameters(
    [
      {
        type: "tuple",
        components: [
          { name: "feeTokenAddress", type: "address" },
          { name: "amount", type: "uint256" },
        ],
      },
    ],
    [{ feeTokenAddress: feeTokenAddress as `0x${string}`, amount }],
  );
}

/** Encode a TeleporterMessage tuple for data field. */
function encodeTeleporterMessage(): `0x${string}` {
  return encodeAbiParameters(
    [
      {
        type: "tuple",
        components: [
          { name: "messageNonce", type: "uint256" },
          { name: "originSenderAddress", type: "address" },
          { name: "destinationBlockchainID", type: "bytes32" },
          { name: "destinationAddress", type: "address" },
          { name: "requiredGasLimit", type: "uint256" },
          { name: "allowedRelayerAddresses", type: "address[]" },
          {
            name: "receipts",
            type: "tuple[]",
            components: [
              { name: "receivedMessageNonce", type: "uint256" },
              { name: "relayerRewardAddress", type: "address" },
            ],
          },
          { name: "message", type: "bytes" },
        ],
      },
    ],
    [
      {
        messageNonce: 1n,
        originSenderAddress: ADDR as `0x${string}`,
        destinationBlockchainID: CHAIN_ID as `0x${string}`,
        destinationAddress: ADDR2 as `0x${string}`,
        requiredGasLimit: 200000n,
        allowedRelayerAddresses: [],
        receipts: [],
        message: "0x" as `0x${string}`,
      },
    ],
  );
}

/** Encode TeleporterMessage + FeeInfo together for SendCrossChainMessage data. */
function encodeSendData(): `0x${string}` {
  return encodeAbiParameters(
    [
      {
        type: "tuple",
        components: [
          { name: "messageNonce", type: "uint256" },
          { name: "originSenderAddress", type: "address" },
          { name: "destinationBlockchainID", type: "bytes32" },
          { name: "destinationAddress", type: "address" },
          { name: "requiredGasLimit", type: "uint256" },
          { name: "allowedRelayerAddresses", type: "address[]" },
          {
            name: "receipts",
            type: "tuple[]",
            components: [
              { name: "receivedMessageNonce", type: "uint256" },
              { name: "relayerRewardAddress", type: "address" },
            ],
          },
          { name: "message", type: "bytes" },
        ],
      },
      {
        type: "tuple",
        components: [
          { name: "feeTokenAddress", type: "address" },
          { name: "amount", type: "uint256" },
        ],
      },
    ],
    [
      {
        messageNonce: 1n,
        originSenderAddress: ADDR as `0x${string}`,
        destinationBlockchainID: CHAIN_ID as `0x${string}`,
        destinationAddress: ADDR2 as `0x${string}`,
        requiredGasLimit: 200000n,
        allowedRelayerAddresses: [],
        receipts: [],
        message: "0x" as `0x${string}`,
      },
      {
        feeTokenAddress: ADDR as `0x${string}`,
        amount: 1000n,
      },
    ],
  );
}

/** Encode rewardRedeemer + TeleporterMessage for ReceiveCrossChainMessage data. */
function encodeReceiveData(): `0x${string}` {
  return encodeAbiParameters(
    [
      { name: "rewardRedeemer", type: "address" },
      {
        type: "tuple",
        components: [
          { name: "messageNonce", type: "uint256" },
          { name: "originSenderAddress", type: "address" },
          { name: "destinationBlockchainID", type: "bytes32" },
          { name: "destinationAddress", type: "address" },
          { name: "requiredGasLimit", type: "uint256" },
          { name: "allowedRelayerAddresses", type: "address[]" },
          {
            name: "receipts",
            type: "tuple[]",
            components: [
              { name: "receivedMessageNonce", type: "uint256" },
              { name: "relayerRewardAddress", type: "address" },
            ],
          },
          { name: "message", type: "bytes" },
        ],
      },
    ],
    [
      ADDR2 as `0x${string}`,
      {
        messageNonce: 1n,
        originSenderAddress: ADDR as `0x${string}`,
        destinationBlockchainID: CHAIN_ID as `0x${string}`,
        destinationAddress: ADDR2 as `0x${string}`,
        requiredGasLimit: 200000n,
        allowedRelayerAddresses: [],
        receipts: [],
        message: "0x" as `0x${string}`,
      },
    ],
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TeleporterMessenger ABI", () => {
  it("exports a valid ABI with 8 event definitions", () => {
    const events = teleporterMessengerAbi.filter((e) => e.type === "event");
    expect(events).toHaveLength(8);
  });

  it("exports the canonical contract address", () => {
    expect(TELEPORTER_MESSENGER_ADDRESS).toBe("0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf");
  });
});

describe("decodeTeleporterLog", () => {
  it("decodes a SendCrossChainMessage log with all fields", () => {
    const topics = encodeEventTopics({
      abi: teleporterMessengerAbi,
      eventName: "SendCrossChainMessage",
      args: {
        messageID: MSG_ID as `0x${string}`,
        destinationBlockchainID: CHAIN_ID as `0x${string}`,
      },
    }) as [`0x${string}`, ...`0x${string}`[]];

    const log: RawLog = {
      address: TELEPORTER_MESSENGER_ADDRESS,
      topics,
      data: encodeSendData(),
      ...baseMeta(),
    };

    const result = decodeTeleporterLog(log);
    expect(result).toBeDefined();
    expect(result!.eventName).toBe("SendCrossChainMessage");
    expect(result!.args).toHaveProperty("messageID");
    expect(result!.args).toHaveProperty("message");
    expect(result!.args).toHaveProperty("feeInfo");
  });

  it("decodes a ReceiveCrossChainMessage log with indexed deliverer", () => {
    const topics = encodeEventTopics({
      abi: teleporterMessengerAbi,
      eventName: "ReceiveCrossChainMessage",
      args: {
        messageID: MSG_ID as `0x${string}`,
        sourceBlockchainID: CHAIN_ID as `0x${string}`,
        deliverer: ADDR as `0x${string}`,
      },
    }) as [`0x${string}`, ...`0x${string}`[]];

    const log: RawLog = {
      address: TELEPORTER_MESSENGER_ADDRESS,
      topics,
      data: encodeReceiveData(),
      ...baseMeta(),
    };

    const result = decodeTeleporterLog(log);
    expect(result).toBeDefined();
    expect(result!.eventName).toBe("ReceiveCrossChainMessage");
    expect(result!.args).toHaveProperty("deliverer");
    expect(result!.args).toHaveProperty("rewardRedeemer");
  });

  it("decodes a MessageExecuted log", () => {
    const topics = encodeEventTopics({
      abi: teleporterMessengerAbi,
      eventName: "MessageExecuted",
      args: { messageID: MSG_ID as `0x${string}`, sourceBlockchainID: CHAIN_ID as `0x${string}` },
    }) as [`0x${string}`, ...`0x${string}`[]];

    const log: RawLog = {
      address: TELEPORTER_MESSENGER_ADDRESS,
      topics,
      data: "0x",
      ...baseMeta(),
    };

    const result = decodeTeleporterLog(log);
    expect(result).toBeDefined();
    expect(result!.eventName).toBe("MessageExecuted");
  });

  it("decodes a MessageExecutionFailed log with embedded message struct", () => {
    const topics = encodeEventTopics({
      abi: teleporterMessengerAbi,
      eventName: "MessageExecutionFailed",
      args: { messageID: MSG_ID as `0x${string}`, sourceBlockchainID: CHAIN_ID as `0x${string}` },
    }) as [`0x${string}`, ...`0x${string}`[]];

    const log: RawLog = {
      address: TELEPORTER_MESSENGER_ADDRESS,
      topics,
      data: encodeTeleporterMessage(),
      ...baseMeta(),
    };

    const result = decodeTeleporterLog(log);
    expect(result).toBeDefined();
    expect(result!.eventName).toBe("MessageExecutionFailed");
    expect(result!.args).toHaveProperty("message");
  });

  it("decodes a BlockchainIDInitialized log", () => {
    const topics = encodeEventTopics({
      abi: teleporterMessengerAbi,
      eventName: "BlockchainIDInitialized",
      args: { blockchainID: CHAIN_ID as `0x${string}` },
    }) as [`0x${string}`, ...`0x${string}`[]];

    const log: RawLog = {
      address: TELEPORTER_MESSENGER_ADDRESS,
      topics,
      data: "0x",
      ...baseMeta(),
    };

    const result = decodeTeleporterLog(log);
    expect(result).toBeDefined();
    expect(result!.eventName).toBe("BlockchainIDInitialized");
  });

  it("decodes an AddFeeAmount log with fee struct", () => {
    const topics = encodeEventTopics({
      abi: teleporterMessengerAbi,
      eventName: "AddFeeAmount",
      args: { messageID: MSG_ID as `0x${string}` },
    }) as [`0x${string}`, ...`0x${string}`[]];

    const log: RawLog = {
      address: TELEPORTER_MESSENGER_ADDRESS,
      topics,
      data: encodeFeeInfo(ADDR, 5000n),
      ...baseMeta(),
    };

    const result = decodeTeleporterLog(log);
    expect(result).toBeDefined();
    expect(result!.eventName).toBe("AddFeeAmount");
    expect(result!.args).toHaveProperty("updatedFeeInfo");
  });

  it("decodes a ReceiptReceived log", () => {
    const topics = encodeEventTopics({
      abi: teleporterMessengerAbi,
      eventName: "ReceiptReceived",
      args: {
        messageID: MSG_ID as `0x${string}`,
        destinationBlockchainID: CHAIN_ID as `0x${string}`,
        relayerRewardAddress: ADDR as `0x${string}`,
      },
    }) as [`0x${string}`, ...`0x${string}`[]];

    const log: RawLog = {
      address: TELEPORTER_MESSENGER_ADDRESS,
      topics,
      data: encodeFeeInfo(ADDR, 100n),
      ...baseMeta(),
    };

    const result = decodeTeleporterLog(log);
    expect(result).toBeDefined();
    expect(result!.eventName).toBe("ReceiptReceived");
  });

  it("decodes a RelayerRewardsRedeemed log with bigint amount", () => {
    const topics = encodeEventTopics({
      abi: teleporterMessengerAbi,
      eventName: "RelayerRewardsRedeemed",
      args: {
        redeemer: ADDR as `0x${string}`,
        asset: ADDR2 as `0x${string}`,
      },
    }) as [`0x${string}`, ...`0x${string}`[]];

    const amount = encodeAbiParameters([{ type: "uint256" }], [999999999999999999n]);

    const log: RawLog = {
      address: TELEPORTER_MESSENGER_ADDRESS,
      topics,
      data: amount,
      ...baseMeta(),
    };

    const result = decodeTeleporterLog(log);
    expect(result).toBeDefined();
    expect(result!.eventName).toBe("RelayerRewardsRedeemed");
    expect(result!.args.amount).toBe(999999999999999999n);
  });

  it("returns undefined for a non-Teleporter log", () => {
    const log: RawLog = {
      address: "0x1234567890123456789012345678901234567890",
      topics: ["0xdeadbeef00000000000000000000000000000000000000000000000000000000"],
      data: "0x",
      ...baseMeta(),
    };

    expect(decodeTeleporterLog(log)).toBeUndefined();
  });

  it("preserves log metadata (blockNumber, txHash, logIndex, blockHash)", () => {
    const topics = encodeEventTopics({
      abi: teleporterMessengerAbi,
      eventName: "MessageExecuted",
      args: { messageID: MSG_ID as `0x${string}`, sourceBlockchainID: CHAIN_ID as `0x${string}` },
    }) as [`0x${string}`, ...`0x${string}`[]];

    const log: RawLog = {
      address: TELEPORTER_MESSENGER_ADDRESS,
      topics,
      data: "0x",
      blockNumber: 42n,
      transactionHash: "0xtx999",
      logIndex: 7,
      blockHash: "0xblock999",
      removed: false,
    };

    const result = decodeTeleporterLog(log)!;
    expect(result.blockNumber).toBe(42n);
    expect(result.transactionHash).toBe("0xtx999");
    expect(result.logIndex).toBe(7);
    expect(result.blockHash).toBe("0xblock999");
  });

  it("sets removed flag from the raw log", () => {
    const topics = encodeEventTopics({
      abi: teleporterMessengerAbi,
      eventName: "MessageExecuted",
      args: { messageID: MSG_ID as `0x${string}`, sourceBlockchainID: CHAIN_ID as `0x${string}` },
    }) as [`0x${string}`, ...`0x${string}`[]];

    const log: RawLog = {
      address: TELEPORTER_MESSENGER_ADDRESS,
      topics,
      data: "0x",
      ...baseMeta(),
      removed: true,
    };

    const result = decodeTeleporterLog(log)!;
    expect(result.removed).toBe(true);
  });
});

describe("decodeTeleporterLogs", () => {
  it("batch decodes mixed logs, filtering non-Teleporter entries", () => {
    const validTopics = encodeEventTopics({
      abi: teleporterMessengerAbi,
      eventName: "MessageExecuted",
      args: { messageID: MSG_ID as `0x${string}`, sourceBlockchainID: CHAIN_ID as `0x${string}` },
    }) as [`0x${string}`, ...`0x${string}`[]];

    const logs: RawLog[] = [
      {
        address: TELEPORTER_MESSENGER_ADDRESS,
        topics: validTopics,
        data: "0x",
        ...baseMeta(),
      },
      {
        address: "0x0000000000000000000000000000000000000000",
        topics: ["0xdeadbeef00000000000000000000000000000000000000000000000000000000"],
        data: "0x",
        ...baseMeta(),
      },
      {
        address: TELEPORTER_MESSENGER_ADDRESS,
        topics: validTopics,
        data: "0x",
        ...baseMeta(),
        logIndex: 1,
      },
    ];

    const results = decodeTeleporterLogs(logs);
    expect(results).toHaveLength(2);
    expect(results[0]!.eventName).toBe("MessageExecuted");
    expect(results[1]!.eventName).toBe("MessageExecuted");
  });

  it("returns empty array for empty input", () => {
    expect(decodeTeleporterLogs([])).toHaveLength(0);
  });
});
