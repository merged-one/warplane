package harness

import (
	"context"
	"fmt"
	"math/big"
	"net/url"
	"os"
)

// CreateNetworkWithTeleporter is the primary entrypoint for standing up a local
// Avalanche tmpnet with two L1 subnets and Teleporter pre-deployed.
//
// It requires AvalancheGo and subnet-evm plugin binaries to be available
// (see docs/runbooks/full-e2e.md for build instructions).
//
// When RUN_E2E is not set this function should never be called; the test suite
// gates invocation in BeforeSuite.
func CreateNetworkWithTeleporter(ctx context.Context) (*NetworkInfo, error) {
	avalancheGoBin := os.Getenv("AVALANCHEGO_PATH")
	if avalancheGoBin == "" {
		return nil, fmt.Errorf("AVALANCHEGO_PATH not set — build avalanchego first (see docs/runbooks/full-e2e.md)")
	}

	pluginDir := os.Getenv("AVALANCHEGO_PLUGIN_DIR")
	if pluginDir == "" {
		return nil, fmt.Errorf("AVALANCHEGO_PLUGIN_DIR not set — build subnet-evm plugin first (see docs/runbooks/full-e2e.md)")
	}

	// Placeholder: the real implementation will use tmpnet.BootstrapNewNetwork
	// to create a 5-node network, deploy 2 subnets with subnet-evm, and then
	// deploy Teleporter contracts via the teleporter deployer.
	//
	// For now we produce a well-typed skeleton that compiles and documents
	// the expected data flow. The next work item (WP-104) fills this in.

	_ = ctx // will be passed to tmpnet calls

	info := &NetworkInfo{
		NetworkID:         88888,
		TeleporterVersion: "v1.0.0",
		Source: L1TestInfo{
			Name:              "source",
			SubnetID:          "", // populated by tmpnet
			BlockchainID:      "", // populated by tmpnet
			EVMChainID:        big.NewInt(99999),
			TeleporterAddress: "", // populated after contract deploy
		},
		Destination: L1TestInfo{
			Name:              "destination",
			SubnetID:          "", // populated by tmpnet
			BlockchainID:      "", // populated by tmpnet
			EVMChainID:        big.NewInt(99998),
			TeleporterAddress: "", // populated after contract deploy
		},
	}

	return info, nil
}

// BuildRPCURL constructs an RPC URL from a node URI and blockchain ID.
func BuildRPCURL(nodeURI, blockchainID string) (*url.URL, error) {
	return url.Parse(fmt.Sprintf("%s/ext/bc/%s/rpc", nodeURI, blockchainID))
}

// BuildWSURL constructs a WebSocket URL from a node URI and blockchain ID.
func BuildWSURL(nodeURI, blockchainID string) (*url.URL, error) {
	httpURL := fmt.Sprintf("%s/ext/bc/%s/ws", nodeURI, blockchainID)
	u, err := url.Parse(httpURL)
	if err != nil {
		return nil, err
	}
	u.Scheme = "ws"
	return u, nil
}
