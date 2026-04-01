package harness

import (
	"math/big"
	"os"
	"path/filepath"
	"testing"
)

func testNetworkInfo() *NetworkInfo {
	return &NetworkInfo{
		NetworkID:         88888,
		TeleporterVersion: "v1.0.0",
		Source: L1TestInfo{
			Name:              "source",
			SubnetID:          "subnet-src-001",
			BlockchainID:      "chain-src-001",
			EVMChainID:        big.NewInt(99999),
			TeleporterAddress: "0xTeleporterSrc",
		},
		Destination: L1TestInfo{
			Name:              "destination",
			SubnetID:          "subnet-dst-001",
			BlockchainID:      "chain-dst-001",
			EVMChainID:        big.NewInt(99998),
			TeleporterAddress: "0xTeleporterDst",
		},
	}
}

func TestScenarioContextSimulateSend(t *testing.T) {
	sc := NewScenarioContext(testNetworkInfo())
	trace := sc.SimulateSend("basic_send_receive", 0)

	if trace.Scenario != "basic_send_receive" {
		t.Fatalf("expected scenario basic_send_receive, got %s", trace.Scenario)
	}
	if trace.Source.Name != "source" {
		t.Fatalf("expected source chain, got %s", trace.Source.Name)
	}
	if len(trace.Events) != 1 {
		t.Fatalf("expected 1 event, got %d", len(trace.Events))
	}
	if trace.Events[0].Kind != EventMessageSent {
		t.Fatalf("expected message_sent event, got %s", trace.Events[0].Kind)
	}
}

func TestScenarioContextFullSendReceive(t *testing.T) {
	tmp := t.TempDir()
	t.Setenv("WARPLANE_ARTIFACTS_DIR", tmp)

	sc := NewScenarioContext(testNetworkInfo())
	trace := sc.SimulateSend("basic_send_receive", 0)
	sc.SimulateExtractWarp(trace, 0)
	sc.SimulateAggregateSignatures(trace, 0)
	sc.SimulateRelay(trace, 0)

	if err := sc.CollectTrace(trace); err != nil {
		t.Fatalf("CollectTrace: %v", err)
	}

	if len(trace.Events) != 5 {
		t.Fatalf("expected 5 events, got %d", len(trace.Events))
	}
	if trace.Execution != OutcomeSuccess {
		t.Fatalf("expected success, got %s", trace.Execution)
	}
	if trace.DestinationTxHash == "" {
		t.Fatal("expected non-empty destination tx hash")
	}

	// Verify artifact written
	path := filepath.Join(tmp, "traces", trace.MessageID+".json")
	if _, err := os.Stat(path); os.IsNotExist(err) {
		t.Fatalf("expected trace file at %s", path)
	}
}

func TestScenarioContextRetry(t *testing.T) {
	sc := NewScenarioContext(testNetworkInfo())
	trace := sc.SimulateSend("retry_failed_execution", 0)
	sc.SimulateExtractWarp(trace, 0)
	sc.SimulateAggregateSignatures(trace, 0)
	sc.SimulateFailedExecution(trace, 0, 21000)
	sc.SimulateRetry(trace, 0, 200000)

	if trace.Execution != OutcomeRetrySuccess {
		t.Fatalf("expected retry_success, got %s", trace.Execution)
	}
	if trace.Retry == nil {
		t.Fatal("expected retry metadata")
	}
	if trace.Retry.OriginalGasLimit != 21000 {
		t.Fatalf("expected original gas 21000, got %d", trace.Retry.OriginalGasLimit)
	}
	if trace.Retry.RetryGasLimit != 200000 {
		t.Fatalf("expected retry gas 200000, got %d", trace.Retry.RetryGasLimit)
	}
}

func TestScenarioContextAddFee(t *testing.T) {
	sc := NewScenarioContext(testNetworkInfo())
	trace := sc.SimulateSend("add_fee", 0)
	sc.SimulateAddFee(trace, 0, "0", "1000000000000000000")

	if trace.Fee == nil {
		t.Fatal("expected fee metadata")
	}
	if trace.Fee.InitialAmount != "0" {
		t.Fatalf("expected initial fee 0, got %s", trace.Fee.InitialAmount)
	}

	feeEvent := false
	for _, e := range trace.Events {
		if e.Kind == EventFeeAdded {
			feeEvent = true
		}
	}
	if !feeEvent {
		t.Fatal("expected fee_added event")
	}
}

func TestScenarioContextReplayBlocked(t *testing.T) {
	sc := NewScenarioContext(testNetworkInfo())
	trace := sc.SimulateSend("replay_or_duplicate_blocked", 0)
	sc.SimulateExtractWarp(trace, 0)
	sc.SimulateAggregateSignatures(trace, 0)
	sc.SimulateReplayBlocked(trace, 0, "message already delivered: duplicate messageId")

	if trace.Execution != OutcomeReplayBlocked {
		t.Fatalf("expected replay_blocked, got %s", trace.Execution)
	}

	blocked := false
	for _, e := range trace.Events {
		if e.Kind == EventReplayBlocked {
			blocked = true
		}
	}
	if !blocked {
		t.Fatal("expected replay_blocked event")
	}
}
