// SPDX-License-Identifier: Apache-2.0
// Minimal Teleporter receiver that echoes messages back. Used in E2E testing.
pragma solidity ^0.8.20;

/// @title EchoReceiver
/// @notice Receives Teleporter messages and stores the last payload for assertion.
///         Keeps contract minimal to reduce deployment gas in tmpnet E2E tests.
contract EchoReceiver {
    /// @notice The Teleporter messenger address authorized to deliver messages.
    address public immutable teleporterMessenger;

    /// @notice Last received message payload.
    bytes public lastPayload;

    /// @notice Last source blockchain ID (Avalanche cb58-encoded, stored as bytes32).
    bytes32 public lastSourceBlockchainID;

    /// @notice Last origin sender address.
    address public lastOriginSender;

    /// @notice Total number of messages received.
    uint256 public messageCount;

    /// @notice Emitted on each successful message receipt.
    event MessageReceived(
        bytes32 indexed sourceBlockchainID,
        address indexed originSender,
        bytes payload
    );

    constructor(address _teleporterMessenger) {
        teleporterMessenger = _teleporterMessenger;
    }

    /// @notice Called by TeleporterMessenger on message delivery.
    /// @param sourceBlockchainID The cb58 blockchain ID of the sender chain.
    /// @param originSenderAddress The address that sent the message on the source chain.
    /// @param message The raw message payload.
    function receiveTeleporterMessage(
        bytes32 sourceBlockchainID,
        address originSenderAddress,
        bytes calldata message
    ) external {
        require(msg.sender == teleporterMessenger, "EchoReceiver: unauthorized");

        lastSourceBlockchainID = sourceBlockchainID;
        lastOriginSender = originSenderAddress;
        lastPayload = message;
        messageCount++;

        emit MessageReceived(sourceBlockchainID, originSenderAddress, message);
    }
}
