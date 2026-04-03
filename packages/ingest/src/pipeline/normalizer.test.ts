import { describe, it, expect } from "vitest";
import { normalize } from "./normalizer.js";
import type { TeleporterEvent } from "../rpc/decoder.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_META = {
  blockNumber: 42n,
  transactionHash: "0xtx42",
  logIndex: 0,
  blockHash: "0xblock42",
  removed: false,
};

const MSG_ID = "0x0000000000000000000000000000000000000000000000000000000000000001";
const DEST_CHAIN = "0x0000000000000000000000000000000000000000000000000000000000000002";
const SRC_CHAIN = "0x0000000000000000000000000000000000000000000000000000000000000003";
const CHAIN_ID = "chain-a";

function makeEvent(
  eventName: string,
  args: Record<string, unknown>,
  overrides?: Partial<TeleporterEvent>,
): TeleporterEvent {
  return { eventName, args, ...BASE_META, ...overrides };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("normalize", () => {
  it("SendCrossChainMessage → message_sent with all fields", () => {
    const event = makeEvent("SendCrossChainMessage", {
      messageID: MSG_ID,
      destinationBlockchainID: DEST_CHAIN,
      message: {
        messageNonce: 1n,
        originSenderAddress: "0xSender",
        destinationBlockchainID: DEST_CHAIN,
        destinationAddress: "0xRecipient",
        requiredGasLimit: 100000n,
        allowedRelayerAddresses: [],
        receipts: [],
        message: "0x",
      },
      feeInfo: { feeTokenAddress: "0xFee", amount: 500n },
    });

    const result = normalize(event, CHAIN_ID);
    expect(result).not.toBeNull();
    expect(result!.kind).toBe("message_sent");
    expect(result!.messageId).toBe(MSG_ID);
    expect(result!.details.destinationBlockchainID).toBe(DEST_CHAIN);
    expect(result!.details.originSenderAddress).toBe("0xSender");
    expect(result!.details.destinationAddress).toBe("0xRecipient");
    expect(result!.details.feeInfo).toEqual({ feeTokenAddress: "0xFee", amount: 500n });
  });

  it("ReceiveCrossChainMessage → delivery_confirmed with deliverer", () => {
    const event = makeEvent("ReceiveCrossChainMessage", {
      messageID: MSG_ID,
      sourceBlockchainID: SRC_CHAIN,
      deliverer: "0xRelayer",
      rewardRedeemer: "0xRedeemer",
      message: {},
    });

    const result = normalize(event, CHAIN_ID);
    expect(result).not.toBeNull();
    expect(result!.kind).toBe("delivery_confirmed");
    expect(result!.details.sourceBlockchainID).toBe(SRC_CHAIN);
    expect(result!.details.deliverer).toBe("0xRelayer");
    expect(result!.details.rewardRedeemer).toBe("0xRedeemer");
  });

  it("MessageExecuted → retry_succeeded", () => {
    const event = makeEvent("MessageExecuted", {
      messageID: MSG_ID,
      sourceBlockchainID: SRC_CHAIN,
    });

    const result = normalize(event, CHAIN_ID);
    expect(result).not.toBeNull();
    expect(result!.kind).toBe("retry_succeeded");
    expect(result!.details.sourceBlockchainID).toBe(SRC_CHAIN);
  });

  it("MessageExecutionFailed → execution_failed", () => {
    const fullMessage = {
      messageNonce: 1n,
      originSenderAddress: "0xSender",
      destinationBlockchainID: DEST_CHAIN,
      destinationAddress: "0xRecipient",
      requiredGasLimit: 100000n,
      allowedRelayerAddresses: [],
      receipts: [],
      message: "0xdata",
    };
    const event = makeEvent("MessageExecutionFailed", {
      messageID: MSG_ID,
      sourceBlockchainID: SRC_CHAIN,
      message: fullMessage,
    });

    const result = normalize(event, CHAIN_ID);
    expect(result).not.toBeNull();
    expect(result!.kind).toBe("execution_failed");
    expect(result!.details.sourceBlockchainID).toBe(SRC_CHAIN);
    expect(result!.details.message).toEqual(fullMessage);
  });

  it("AddFeeAmount → fee_added", () => {
    const event = makeEvent("AddFeeAmount", {
      messageID: MSG_ID,
      updatedFeeInfo: { feeTokenAddress: "0xFee", amount: 1000n },
    });

    const result = normalize(event, CHAIN_ID);
    expect(result).not.toBeNull();
    expect(result!.kind).toBe("fee_added");
    expect(result!.details.updatedFeeInfo).toEqual({ feeTokenAddress: "0xFee", amount: 1000n });
  });

  it("ReceiptReceived → receipts_sent", () => {
    const event = makeEvent("ReceiptReceived", {
      messageID: MSG_ID,
      destinationBlockchainID: DEST_CHAIN,
      relayerRewardAddress: "0xRelayerReward",
      feeInfo: { feeTokenAddress: "0xFee", amount: 200n },
    });

    const result = normalize(event, CHAIN_ID);
    expect(result).not.toBeNull();
    expect(result!.kind).toBe("receipts_sent");
    expect(result!.details.destinationBlockchainID).toBe(DEST_CHAIN);
    expect(result!.details.relayerRewardAddress).toBe("0xRelayerReward");
  });

  it("BlockchainIDInitialized → null", () => {
    const event = makeEvent("BlockchainIDInitialized", {
      blockchainID: "0xabc",
    });

    expect(normalize(event, CHAIN_ID)).toBeNull();
  });

  it("RelayerRewardsRedeemed → null", () => {
    const event = makeEvent("RelayerRewardsRedeemed", {
      redeemer: "0xRedeemer",
      asset: "0xAsset",
      amount: 999n,
    });

    expect(normalize(event, CHAIN_ID)).toBeNull();
  });

  it("extracts messageId from args correctly", () => {
    const event = makeEvent("SendCrossChainMessage", {
      messageID: MSG_ID,
      destinationBlockchainID: DEST_CHAIN,
      message: {},
      feeInfo: {},
    });

    const result = normalize(event, CHAIN_ID);
    expect(result!.messageId).toBe(MSG_ID);
  });

  it("preserves block metadata (blockNumber, txHash)", () => {
    const event = makeEvent(
      "SendCrossChainMessage",
      { messageID: MSG_ID, destinationBlockchainID: DEST_CHAIN, message: {}, feeInfo: {} },
      { blockNumber: 999n, transactionHash: "0xSpecialTx" },
    );

    const result = normalize(event, CHAIN_ID);
    expect(result!.blockNumber).toBe(999);
    expect(result!.txHash).toBe("0xSpecialTx");
  });

  it("sets chain field from chainId parameter", () => {
    const event = makeEvent("MessageExecuted", {
      messageID: MSG_ID,
      sourceBlockchainID: SRC_CHAIN,
    });

    const result = normalize(event, "my-custom-chain");
    expect(result!.chain).toBe("my-custom-chain");
    expect(result!.source).toBe("on-chain");
  });

  it("returns null for unknown/malformed events", () => {
    const unknown = makeEvent("SomeUnknownEvent", { foo: "bar" });
    expect(normalize(unknown, CHAIN_ID)).toBeNull();

    const noMessageId = makeEvent("MessageExecuted", { sourceBlockchainID: SRC_CHAIN });
    expect(normalize(noMessageId, CHAIN_ID)).toBeNull();
  });
});
