// Package harness provides shared types and helpers for the Warplane tmpnet
// end-to-end test harness. It models the Avalanche L1 network topology needed
// for cross-chain (Teleporter/ICM) integration testing.
package harness

import (
	"math/big"
	"net/url"
)

// L1TestInfo captures everything a test needs to interact with a single
// Avalanche L1 deployed inside a tmpnet network.
type L1TestInfo struct {
	// Name is a human-readable label (e.g. "source" or "destination").
	Name string `json:"name"`

	// SubnetID is the cb58-encoded Subnet ID on the P-Chain.
	SubnetID string `json:"subnetId"`

	// BlockchainID is the cb58-encoded blockchain ID on the P-Chain.
	BlockchainID string `json:"blockchainId"`

	// EVMChainID is the EVM chain ID used by the subnet-evm instance.
	EVMChainID *big.Int `json:"evmChainId"`

	// NodeURIs lists the HTTP API endpoints of nodes validating this L1.
	NodeURIs []string `json:"nodeUris"`

	// RPCURL is the primary JSON-RPC endpoint for this chain.
	// Typically http://<node>/ext/bc/<blockchainID>/rpc
	RPCURL *url.URL `json:"-"`

	// WSUrl is the primary WebSocket endpoint for this chain.
	WSURL *url.URL `json:"-"`

	// TeleporterAddress is the deployed TeleporterMessenger contract address.
	TeleporterAddress string `json:"teleporterAddress"`

	// TeleporterRegistryAddress is the deployed TeleporterRegistry address.
	TeleporterRegistryAddress string `json:"teleporterRegistryAddress"`

	// FundedKey is the hex-encoded private key pre-funded on this L1.
	FundedKey string `json:"fundedKey"`
}

// NetworkInfo holds the full test network topology written to artifacts.
type NetworkInfo struct {
	// NetworkDir is the tmpnet data directory on disk.
	NetworkDir string `json:"networkDir"`

	// NetworkID is the Avalanche network ID (typically 88888 for tmpnet).
	NetworkID uint32 `json:"networkId"`

	// Source is the L1 used as the message sender in cross-chain tests.
	Source L1TestInfo `json:"source"`

	// Destination is the L1 used as the message receiver.
	Destination L1TestInfo `json:"destination"`

	// PChainNodeURIs are API endpoints for the primary network validators.
	PChainNodeURIs []string `json:"pChainNodeUris"`

	// TeleporterVersion records which Teleporter contracts were deployed.
	TeleporterVersion string `json:"teleporterVersion"`
}
