// Command generate-golden produces deterministic golden trace fixtures
// from the Teleporter scenario model. These fixtures can be committed
// to the repo and used for regression testing and API/CLI development.
//
// Usage:
//
//	go run ./cmd/generate-golden [--output-dir artifacts]
package main

import (
	"flag"
	"fmt"
	"math/big"
	"os"

	"github.com/warplane/harness/tmpnet/pkg/harness"
)

func main() {
	outputDir := flag.String("output-dir", "artifacts", "directory for golden fixtures")
	flag.Parse()

	os.Setenv("WARPLANE_ARTIFACTS_DIR", *outputDir)

	net := &harness.NetworkInfo{
		NetworkDir:        "/tmp/warplane-tmpnet",
		NetworkID:         88888,
		TeleporterVersion: "v1.0.0",
		Source: harness.L1TestInfo{
			Name:                      "source",
			SubnetID:                  "subnet-src-001",
			BlockchainID:              "chain-src-001",
			EVMChainID:                big.NewInt(99999),
			NodeURIs:                  []string{"http://127.0.0.1:9650"},
			TeleporterAddress:         "0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf",
			TeleporterRegistryAddress: "0x17aB05351fC94a1a67Bf3f56DdbB941aE6c63E25",
			FundedKey:                 "56289e99c94b6912bfc12adc093c9b51124f0dc54ac7a766b2bc5ccf558d8027",
		},
		Destination: harness.L1TestInfo{
			Name:                      "destination",
			SubnetID:                  "subnet-dst-001",
			BlockchainID:              "chain-dst-001",
			EVMChainID:                big.NewInt(99998),
			NodeURIs:                  []string{"http://127.0.0.1:9652"},
			TeleporterAddress:         "0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf",
			TeleporterRegistryAddress: "0x17aB05351fC94a1a67Bf3f56DdbB941aE6c63E25",
			FundedKey:                 "2e8db68a2e4dab8e4009f6b879f48f5b1d4e4bdb8f7e9f2e1c7d3a5b6e8f9012",
		},
		PChainNodeURIs: []string{"http://127.0.0.1:9650", "http://127.0.0.1:9651"},
	}

	// Write network info
	if err := harness.WriteNetworkInfo(net); err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: %v\n", err)
		os.Exit(1)
	}

	sc := harness.NewScenarioContext(net)

	// Scenario 1: basic_send_receive
	{
		t := sc.SimulateSend("basic_send_receive", 0)
		sc.SimulateExtractWarp(t, 0)
		sc.SimulateAggregateSignatures(t, 0)
		sc.SimulateRelay(t, 0)
		must(sc.CollectTrace(t))
		must(sc.FinalizeScenario("basic_send_receive", true, ""))
	}

	// Scenario 2: add_fee
	{
		t := sc.SimulateSend("add_fee", 1)
		sc.SimulateAddFee(t, 1, "0", "1000000000000000000")
		sc.SimulateExtractWarp(t, 1)
		sc.SimulateAggregateSignatures(t, 1)
		sc.SimulateRelay(t, 1)
		must(sc.CollectTrace(t))
		must(sc.FinalizeScenario("add_fee", true, ""))
	}

	// Scenario 3: specified_receipts
	{
		var receiptIDs []string
		for i := 0; i < 3; i++ {
			t := sc.SimulateSend("specified_receipts", 2+i)
			sc.SimulateExtractWarp(t, 2+i)
			sc.SimulateAggregateSignatures(t, 2+i)
			sc.SimulateRelay(t, 2+i)
			must(sc.CollectTrace(t))
			receiptIDs = append(receiptIDs, t.MessageID[:16])
		}
		rt := sc.SimulateSend("specified_receipts/receipts", 5)
		rt.Source, rt.Destination = rt.Destination, rt.Source
		sc.SimulateReceiptsSent(rt, 5, receiptIDs)
		must(sc.CollectTrace(rt))
		must(sc.FinalizeScenario("specified_receipts", true, ""))
	}

	// Scenario 4: retry_failed_execution
	{
		t := sc.SimulateSend("retry_failed_execution", 6)
		sc.SimulateExtractWarp(t, 6)
		sc.SimulateAggregateSignatures(t, 6)
		sc.SimulateFailedExecution(t, 6, 21000)
		sc.SimulateRetry(t, 6, 200000)
		must(sc.CollectTrace(t))
		must(sc.FinalizeScenario("retry_failed_execution", true, ""))
	}

	// Scenario 5: replay_or_duplicate_blocked
	{
		t := sc.SimulateSend("replay_or_duplicate_blocked", 7)
		sc.SimulateExtractWarp(t, 7)
		sc.SimulateAggregateSignatures(t, 7)
		sc.SimulateRelay(t, 7)
		must(sc.CollectTrace(t))

		dup := sc.SimulateSend("replay_or_duplicate_blocked/duplicate", 8)
		dup.MessageID = t.MessageID
		sc.SimulateExtractWarp(dup, 8)
		sc.SimulateAggregateSignatures(dup, 8)
		sc.SimulateReplayBlocked(dup, 8, "message already delivered: duplicate messageId")
		must(sc.CollectTrace(dup))
		must(sc.FinalizeScenario("replay_or_duplicate_blocked", true, ""))
	}

	// Write consolidated trace index
	must(sc.WriteTraceIndexFromContext())

	fmt.Printf("Golden fixtures written to %s/\n", *outputDir)
	fmt.Printf("  network/network.json\n")
	fmt.Printf("  scenarios/ (5 scenario run files)\n")
	fmt.Printf("  traces/ (%d trace files + index.json)\n", len(sc.Traces))
}

func must(err error) {
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: %v\n", err)
		os.Exit(1)
	}
}
