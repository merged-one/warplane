/**
 * Event normalizer — maps raw TeleporterMessenger events to canonical NormalizedEvent.
 *
 * Pure function, no I/O. Handles the 8 TeleporterMessenger contract events:
 * - SendCrossChainMessage     → message_sent
 * - ReceiveCrossChainMessage  → delivery_confirmed
 * - MessageExecuted           → retry_succeeded
 * - MessageExecutionFailed    → execution_failed
 * - AddFeeAmount              → fee_added
 * - ReceiptReceived           → receipts_sent
 * - BlockchainIDInitialized   → skipped (null)
 * - RelayerRewardsRedeemed    → skipped (null)
 */

import type { MessageEventKind } from "@warplane/domain";
import type { TeleporterEvent } from "../rpc/decoder.js";
import type { NormalizedEvent } from "./types.js";

// ---------------------------------------------------------------------------
// Event name → kind mapping
// ---------------------------------------------------------------------------

const EVENT_MAP: Record<string, MessageEventKind | null> = {
  SendCrossChainMessage: "message_sent",
  ReceiveCrossChainMessage: "delivery_confirmed",
  MessageExecuted: "retry_succeeded",
  MessageExecutionFailed: "execution_failed",
  AddFeeAmount: "fee_added",
  ReceiptReceived: "receipts_sent",
  BlockchainIDInitialized: null,
  RelayerRewardsRedeemed: null,
};

// ---------------------------------------------------------------------------
// Normalizer
// ---------------------------------------------------------------------------

/**
 * Normalize a decoded TeleporterEvent into a canonical NormalizedEvent.
 *
 * Returns `null` for events that don't map to a lifecycle event
 * (BlockchainIDInitialized, RelayerRewardsRedeemed) or unknown events.
 *
 * @param event  Decoded TeleporterMessenger event from the RPC decoder
 * @param chainId  Avalanche blockchain ID where this event was observed
 */
export function normalize(event: TeleporterEvent, chainId: string): NormalizedEvent | null {
  const kind = EVENT_MAP[event.eventName];
  if (kind === undefined || kind === null) return null;

  const messageId = extractMessageId(event);
  if (!messageId) return null;

  return {
    kind,
    messageId,
    timestamp: "", // enriched by coordinator with block timestamp
    blockNumber: Number(event.blockNumber),
    txHash: event.transactionHash,
    chain: chainId,
    source: "on-chain",
    details: extractDetails(event),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractMessageId(event: TeleporterEvent): string | null {
  const id = event.args.messageID;
  if (typeof id === "string") return id;
  return null;
}

function extractDetails(event: TeleporterEvent): Record<string, unknown> {
  const details: Record<string, unknown> = {};

  switch (event.eventName) {
    case "SendCrossChainMessage": {
      const msg = event.args.message as Record<string, unknown> | undefined;
      details.destinationBlockchainID = event.args.destinationBlockchainID;
      if (msg) {
        details.originSenderAddress = msg.originSenderAddress;
        details.destinationAddress = msg.destinationAddress;
        details.requiredGasLimit = String(msg.requiredGasLimit ?? "");
      }
      details.feeInfo = event.args.feeInfo;
      break;
    }
    case "ReceiveCrossChainMessage":
      details.sourceBlockchainID = event.args.sourceBlockchainID;
      details.deliverer = event.args.deliverer;
      details.rewardRedeemer = event.args.rewardRedeemer;
      break;
    case "MessageExecuted":
      details.sourceBlockchainID = event.args.sourceBlockchainID;
      break;
    case "MessageExecutionFailed":
      details.sourceBlockchainID = event.args.sourceBlockchainID;
      details.message = event.args.message;
      break;
    case "AddFeeAmount":
      details.updatedFeeInfo = event.args.updatedFeeInfo;
      break;
    case "ReceiptReceived":
      details.destinationBlockchainID = event.args.destinationBlockchainID;
      details.relayerRewardAddress = event.args.relayerRewardAddress;
      details.feeInfo = event.args.feeInfo;
      break;
  }

  return details;
}
