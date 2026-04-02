/**
 * TeleporterMessenger ABI for event decoding.
 *
 * Covers all 8 events emitted by the TeleporterMessenger contract (v1.0.9).
 * Defined as a viem-compatible `as const` assertion for full type inference.
 *
 * @see https://github.com/ava-labs/icm-contracts/blob/main/contracts/teleporter/ITeleporterMessenger.sol
 */

/** Canonical TeleporterMessenger address (same on all Avalanche chains). */
export const TELEPORTER_MESSENGER_ADDRESS = "0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf" as const;

/**
 * ABI for TeleporterMessenger events.
 *
 * Struct definitions:
 * - TeleporterMessage: messageNonce, originSenderAddress, destinationBlockchainID,
 *   destinationAddress, requiredGasLimit, allowedRelayerAddresses, receipts, message
 * - TeleporterFeeInfo: feeTokenAddress, amount
 * - TeleporterMessageReceipt: receivedMessageNonce, relayerRewardAddress
 */
export const teleporterMessengerAbi = [
  // --- Event 1: BlockchainIDInitialized ---
  {
    type: "event",
    name: "BlockchainIDInitialized",
    inputs: [{ name: "blockchainID", type: "bytes32", indexed: true }],
  },

  // --- Event 2: SendCrossChainMessage ---
  {
    type: "event",
    name: "SendCrossChainMessage",
    inputs: [
      { name: "messageID", type: "bytes32", indexed: true },
      { name: "destinationBlockchainID", type: "bytes32", indexed: true },
      {
        name: "message",
        type: "tuple",
        indexed: false,
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
        name: "feeInfo",
        type: "tuple",
        indexed: false,
        components: [
          { name: "feeTokenAddress", type: "address" },
          { name: "amount", type: "uint256" },
        ],
      },
    ],
  },

  // --- Event 3: AddFeeAmount ---
  {
    type: "event",
    name: "AddFeeAmount",
    inputs: [
      { name: "messageID", type: "bytes32", indexed: true },
      {
        name: "updatedFeeInfo",
        type: "tuple",
        indexed: false,
        components: [
          { name: "feeTokenAddress", type: "address" },
          { name: "amount", type: "uint256" },
        ],
      },
    ],
  },

  // --- Event 4: ReceiveCrossChainMessage ---
  {
    type: "event",
    name: "ReceiveCrossChainMessage",
    inputs: [
      { name: "messageID", type: "bytes32", indexed: true },
      { name: "sourceBlockchainID", type: "bytes32", indexed: true },
      { name: "deliverer", type: "address", indexed: true },
      { name: "rewardRedeemer", type: "address", indexed: false },
      {
        name: "message",
        type: "tuple",
        indexed: false,
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
  },

  // --- Event 5: MessageExecuted ---
  {
    type: "event",
    name: "MessageExecuted",
    inputs: [
      { name: "messageID", type: "bytes32", indexed: true },
      { name: "sourceBlockchainID", type: "bytes32", indexed: true },
    ],
  },

  // --- Event 6: MessageExecutionFailed ---
  {
    type: "event",
    name: "MessageExecutionFailed",
    inputs: [
      { name: "messageID", type: "bytes32", indexed: true },
      { name: "sourceBlockchainID", type: "bytes32", indexed: true },
      {
        name: "message",
        type: "tuple",
        indexed: false,
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
  },

  // --- Event 7: ReceiptReceived ---
  {
    type: "event",
    name: "ReceiptReceived",
    inputs: [
      { name: "messageID", type: "bytes32", indexed: true },
      { name: "destinationBlockchainID", type: "bytes32", indexed: true },
      { name: "relayerRewardAddress", type: "address", indexed: true },
      {
        name: "feeInfo",
        type: "tuple",
        indexed: false,
        components: [
          { name: "feeTokenAddress", type: "address" },
          { name: "amount", type: "uint256" },
        ],
      },
    ],
  },

  // --- Event 8: RelayerRewardsRedeemed ---
  {
    type: "event",
    name: "RelayerRewardsRedeemed",
    inputs: [
      { name: "redeemer", type: "address", indexed: true },
      { name: "asset", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;
