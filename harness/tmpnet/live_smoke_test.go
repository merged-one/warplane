package main

// Live-network smoke tests for Warplane against real Avalanche endpoints.
//
// These tests start a real Warplane API server pointed at live Avalanche
// RPC endpoints (Fuji testnet and/or Mainnet) and verify the full pipeline
// starts successfully: RPC → orchestrator → pipeline → DB → API.
//
// Gated by RUN_LIVE_SMOKE — never runs during regular `go test`.
//
// Usage:
//
//	RUN_LIVE_SMOKE=1 DATABASE_URL=postgresql://... go test -v -run TestLiveSmoke -timeout 5m ./...

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/warplane/harness/tmpnet/pkg/harness"
)

// skipIfNoLiveSmoke skips the test unless RUN_LIVE_SMOKE is set.
func skipIfNoLiveSmoke(t *testing.T) {
	t.Helper()
	if os.Getenv("RUN_LIVE_SMOKE") == "" {
		t.Skip("skipping live smoke test (set RUN_LIVE_SMOKE=1 to run)")
	}
	skipIfNoBinary(t)
}

// recentStartBlock calls eth_blockNumber on the given RPC URL and returns
// a block number ~100 blocks behind tip. This avoids backfilling from 0.
func recentStartBlock(rpcUrl string) (int64, error) {
	payload := `{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}`

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Post(rpcUrl, "application/json", strings.NewReader(payload))
	if err != nil {
		return 0, fmt.Errorf("eth_blockNumber: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		Result string `json:"result"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return 0, fmt.Errorf("decode block number: %w", err)
	}

	var blockNum int64
	_, err = fmt.Sscanf(result.Result, "0x%x", &blockNum)
	if err != nil || blockNum <= 0 {
		return 0, fmt.Errorf("invalid block number: %s", result.Result)
	}

	start := blockNum - 100
	if start < 0 {
		start = 0
	}
	return start, nil
}

// writeTempConfig writes a warplane YAML config to a temp file and returns
// the path. The file is cleaned up when t completes.
func writeTempConfig(t *testing.T, yaml string) string {
	t.Helper()
	dir := t.TempDir()
	path := filepath.Join(dir, "warplane.yaml")
	if err := os.WriteFile(path, []byte(yaml), 0644); err != nil {
		t.Fatalf("write temp config: %v", err)
	}
	return path
}

// fujiConfigYAML returns a Fuji-only config with the given startBlock.
func fujiConfigYAML(startBlock int64) string {
	return fmt.Sprintf(`chains:
  - name: "Fuji C-Chain"
    blockchainId: "yH8D7ThNJkxmtkuv2jgBa4P1Rn3Qpr4pPr7QYNfcdoS6k6HWp"
    evmChainId: 43113
    rpcUrl: "https://api.avax-test.network/ext/bc/C/rpc"
    teleporterAddress: "0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf"
    startBlock: %d
logLevel: "warn"
`, startBlock)
}

// mainnetConfigYAML returns a Mainnet-only config with the given startBlock.
func mainnetConfigYAML(startBlock int64) string {
	return fmt.Sprintf(`chains:
  - name: "Mainnet C-Chain"
    blockchainId: "2q9e4r6Mu3U68nU1fYjgbR6JvwrRx36CohpAX5UQxse55x1Q5"
    evmChainId: 43114
    rpcUrl: "https://api.avax.network/ext/bc/C/rpc"
    teleporterAddress: "0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf"
    startBlock: %d
logLevel: "warn"
`, startBlock)
}

// multiNetworkConfigYAML returns a config with both networks.
func multiNetworkConfigYAML(fujiStart, mainnetStart int64) string {
	return fmt.Sprintf(`chains:
  - name: "Mainnet C-Chain"
    blockchainId: "2q9e4r6Mu3U68nU1fYjgbR6JvwrRx36CohpAX5UQxse55x1Q5"
    evmChainId: 43114
    rpcUrl: "https://api.avax.network/ext/bc/C/rpc"
    teleporterAddress: "0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf"
    startBlock: %d
  - name: "Fuji C-Chain"
    blockchainId: "yH8D7ThNJkxmtkuv2jgBa4P1Rn3Qpr4pPr7QYNfcdoS6k6HWp"
    evmChainId: 43113
    rpcUrl: "https://api.avax-test.network/ext/bc/C/rpc"
    teleporterAddress: "0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf"
    startBlock: %d
logLevel: "warn"
`, mainnetStart, fujiStart)
}

// startLiveServer starts a Warplane server with the given config and waits healthy.
func startLiveServer(t *testing.T, configPath string) *harness.WarplaneInstance {
	t.Helper()

	ctx := context.Background()
	inst, err := harness.StartWarplane(ctx, harness.WarplaneOpts{
		ConfigPath: configPath,
	})
	if err != nil {
		t.Fatalf("failed to start warplane: %v", err)
	}

	healthCtx, healthCancel := context.WithTimeout(ctx, 60*time.Second)
	defer healthCancel()

	if err := inst.WaitHealthy(healthCtx); err != nil {
		inst.Stop()
		t.Fatalf("warplane did not become healthy: %v", err)
	}

	t.Cleanup(func() { inst.Stop() })
	return inst
}

// waitForPipelineChain polls pipeline status until a chain with the given
// chainId appears in a non-empty mode, or the context expires.
func waitForPipelineChain(ctx context.Context, inst *harness.WarplaneInstance, chainId int) (*harness.PipelineChainStatus, error) {
	for {
		status, err := inst.GetPipelineStatus()
		if err == nil {
			for _, c := range status.Chains {
				if c.ChainID == chainId && c.Mode != "" {
					return &c, nil
				}
			}
		}

		select {
		case <-ctx.Done():
			return nil, fmt.Errorf("timed out waiting for chain %d in pipeline status", chainId)
		case <-time.After(2 * time.Second):
		}
	}
}

func TestLiveSmokeFujiConnectivity(t *testing.T) {
	skipIfNoLiveSmoke(t)

	const rpcUrl = "https://api.avax-test.network/ext/bc/C/rpc"
	startBlock, err := recentStartBlock(rpcUrl)
	if err != nil {
		t.Fatalf("get Fuji tip block: %v", err)
	}
	t.Logf("Fuji startBlock: %d", startBlock)

	configPath := writeTempConfig(t, fujiConfigYAML(startBlock))
	inst := startLiveServer(t, configPath)

	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()

	chain, err := waitForPipelineChain(ctx, inst, 43113)
	if err != nil {
		t.Fatalf("Fuji chain not found in pipeline: %v", err)
	}

	t.Logf("Fuji chain mode=%s lastBlock=%d", chain.Mode, chain.LastBlock)
	if chain.Mode != "backfill" && chain.Mode != "live" {
		t.Errorf("expected mode backfill or live, got %s", chain.Mode)
	}
	if chain.Error != "" {
		t.Errorf("unexpected chain error: %s", chain.Error)
	}
}

func TestLiveSmokeMainnetConnectivity(t *testing.T) {
	skipIfNoLiveSmoke(t)

	const rpcUrl = "https://api.avax.network/ext/bc/C/rpc"
	startBlock, err := recentStartBlock(rpcUrl)
	if err != nil {
		t.Fatalf("get Mainnet tip block: %v", err)
	}
	t.Logf("Mainnet startBlock: %d", startBlock)

	configPath := writeTempConfig(t, mainnetConfigYAML(startBlock))
	inst := startLiveServer(t, configPath)

	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()

	chain, err := waitForPipelineChain(ctx, inst, 43114)
	if err != nil {
		t.Fatalf("Mainnet chain not found in pipeline: %v", err)
	}

	t.Logf("Mainnet chain mode=%s lastBlock=%d", chain.Mode, chain.LastBlock)
	if chain.Mode != "backfill" && chain.Mode != "live" {
		t.Errorf("expected mode backfill or live, got %s", chain.Mode)
	}
	if chain.Error != "" {
		t.Errorf("unexpected chain error: %s", chain.Error)
	}
}

func TestLiveSmokeMultiNetwork(t *testing.T) {
	skipIfNoLiveSmoke(t)

	fujiStart, err := recentStartBlock("https://api.avax-test.network/ext/bc/C/rpc")
	if err != nil {
		t.Fatalf("get Fuji tip block: %v", err)
	}
	mainnetStart, err := recentStartBlock("https://api.avax.network/ext/bc/C/rpc")
	if err != nil {
		t.Fatalf("get Mainnet tip block: %v", err)
	}
	t.Logf("startBlocks: fuji=%d mainnet=%d", fujiStart, mainnetStart)

	configPath := writeTempConfig(t, multiNetworkConfigYAML(fujiStart, mainnetStart))
	inst := startLiveServer(t, configPath)

	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()

	// Wait for both chains
	fujiChain, err := waitForPipelineChain(ctx, inst, 43113)
	if err != nil {
		t.Fatalf("Fuji chain not found: %v", err)
	}
	mainnetChain, err := waitForPipelineChain(ctx, inst, 43114)
	if err != nil {
		t.Fatalf("Mainnet chain not found: %v", err)
	}

	t.Logf("Fuji: mode=%s lastBlock=%d", fujiChain.Mode, fujiChain.LastBlock)
	t.Logf("Mainnet: mode=%s lastBlock=%d", mainnetChain.Mode, mainnetChain.LastBlock)

	for _, c := range []struct {
		name  string
		chain *harness.PipelineChainStatus
	}{
		{"Fuji", fujiChain},
		{"Mainnet", mainnetChain},
	} {
		if c.chain.Mode != "backfill" && c.chain.Mode != "live" {
			t.Errorf("%s: expected mode backfill or live, got %s", c.name, c.chain.Mode)
		}
		if c.chain.Error != "" {
			t.Errorf("%s: unexpected error: %s", c.name, c.chain.Error)
		}
	}
}
