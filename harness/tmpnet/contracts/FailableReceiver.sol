// SPDX-License-Identifier: Apache-2.0
// Teleporter receiver with configurable gas consumption for retry testing.
pragma solidity ^0.8.20;

/// @title FailableReceiver
/// @notice A Teleporter message receiver that consumes configurable gas on receive.
///         Used to test retry_failed_execution scenarios: deploy with a high
///         gasToConsume so that a relay with low RequiredGasLimit causes execution
///         to fail, then retry with enough gas.
contract FailableReceiver {
    /// @notice The Teleporter messenger address authorized to deliver messages.
    address public immutable teleporterMessenger;

    /// @notice Amount of gas to burn on each receive. Set high to trigger
    ///         execution failures when RequiredGasLimit is too low.
    uint256 public gasToConsume;

    /// @notice Last received payload (set only on successful execution).
    bytes public lastPayload;

    /// @notice Total successful executions.
    uint256 public successCount;

    /// @notice Emitted on successful receive.
    event ExecutionSucceeded(
        bytes32 indexed sourceBlockchainID,
        address indexed originSender,
        bytes payload
    );

    /// @notice Emitted when gas consumption exceeds available gas.
    event ExecutionAttempted(
        bytes32 indexed sourceBlockchainID,
        uint256 gasRemaining
    );

    constructor(address _teleporterMessenger, uint256 _gasToConsume) {
        teleporterMessenger = _teleporterMessenger;
        gasToConsume = _gasToConsume;
    }

    /// @notice Called by TeleporterMessenger on message delivery.
    function receiveTeleporterMessage(
        bytes32 sourceBlockchainID,
        address originSenderAddress,
        bytes calldata message
    ) external {
        require(msg.sender == teleporterMessenger, "FailableReceiver: unauthorized");

        emit ExecutionAttempted(sourceBlockchainID, gasleft());

        // Consume gas by writing to storage in a loop.
        // If gasleft() < gasToConsume the transaction will revert.
        uint256 target = gasToConsume;
        uint256 consumed = 0;
        while (consumed < target) {
            // Each SSTORE costs ~20,000 gas; use a scratch slot.
            assembly {
                sstore(0xdead, consumed)
            }
            consumed += 20000;
        }

        lastPayload = message;
        successCount++;

        emit ExecutionSucceeded(sourceBlockchainID, originSenderAddress, message);
    }

    /// @notice Update the gas consumption target (for test flexibility).
    function setGasToConsume(uint256 _gasToConsume) external {
        gasToConsume = _gasToConsume;
    }
}
