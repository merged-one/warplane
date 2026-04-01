package harness

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestDeterministicMessageID(t *testing.T) {
	id1 := DeterministicMessageID("basic_send_receive", 0)
	id2 := DeterministicMessageID("basic_send_receive", 0)
	id3 := DeterministicMessageID("basic_send_receive", 1)

	if id1 != id2 {
		t.Fatalf("expected deterministic output, got %s and %s", id1, id2)
	}
	if id1 == id3 {
		t.Fatal("expected different IDs for different sequences")
	}
	if len(id1) != 64 {
		t.Fatalf("expected 64-char hex ID, got %d chars", len(id1))
	}
}

func TestWriteAndReadTrace(t *testing.T) {
	tmp := t.TempDir()
	t.Setenv("WARPLANE_ARTIFACTS_DIR", tmp)

	trace := &MessageTrace{
		MessageID: "abc123def456",
		Scenario:  "test_scenario",
		Source:    ChainMeta{Name: "source", EVMChainID: 99999},
		Destination: ChainMeta{Name: "destination", EVMChainID: 99998},
		Sender:       "0xsender",
		Recipient:    "0xrecipient",
		SourceTxHash: "0xsourcetx",
		Timestamps: TraceTimestamps{
			SendTime:  time.Date(2026, 4, 1, 0, 0, 0, 0, time.UTC),
			BlockSend: 100,
		},
		Events: []TraceEvent{
			{Kind: EventMessageSent, Timestamp: time.Date(2026, 4, 1, 0, 0, 0, 0, time.UTC)},
		},
		Execution: OutcomeSuccess,
	}

	if err := WriteTrace(trace); err != nil {
		t.Fatalf("WriteTrace: %v", err)
	}

	path := filepath.Join(tmp, "traces", "abc123def456.json")
	if _, err := os.Stat(path); os.IsNotExist(err) {
		t.Fatalf("expected trace file at %s", path)
	}

	got, err := ReadTrace("abc123def456")
	if err != nil {
		t.Fatalf("ReadTrace: %v", err)
	}
	if got.Scenario != "test_scenario" {
		t.Fatalf("expected scenario test_scenario, got %s", got.Scenario)
	}
	if got.Execution != OutcomeSuccess {
		t.Fatalf("expected outcome success, got %s", got.Execution)
	}
}

func TestWriteAndReadTraceIndex(t *testing.T) {
	tmp := t.TempDir()
	t.Setenv("WARPLANE_ARTIFACTS_DIR", tmp)

	idx := &TraceIndex{
		GeneratedAt: time.Date(2026, 4, 1, 0, 10, 0, 0, time.UTC),
		Traces: []TraceIndexEntry{
			{MessageID: "msg1", Scenario: "basic", File: "msg1.json", Execution: OutcomeSuccess},
			{MessageID: "msg2", Scenario: "retry", File: "msg2.json", Execution: OutcomeRetrySuccess},
		},
	}

	if err := WriteTraceIndex(idx); err != nil {
		t.Fatalf("WriteTraceIndex: %v", err)
	}

	got, err := ReadTraceIndex()
	if err != nil {
		t.Fatalf("ReadTraceIndex: %v", err)
	}
	if len(got.Traces) != 2 {
		t.Fatalf("expected 2 trace entries, got %d", len(got.Traces))
	}
}

func TestWriteAndReadScenarioRun(t *testing.T) {
	tmp := t.TempDir()
	t.Setenv("WARPLANE_ARTIFACTS_DIR", tmp)

	run := &ScenarioRun{
		Scenario:    "basic_send_receive",
		StartedAt:   time.Date(2026, 4, 1, 0, 0, 0, 0, time.UTC),
		CompletedAt: time.Date(2026, 4, 1, 0, 5, 0, 0, time.UTC),
		Passed:      true,
		MessageIDs:  []string{"msg1"},
		TraceFiles:  []string{"msg1.json"},
	}

	if err := WriteScenarioRun(run); err != nil {
		t.Fatalf("WriteScenarioRun: %v", err)
	}

	got, err := ReadScenarioRun("basic_send_receive")
	if err != nil {
		t.Fatalf("ReadScenarioRun: %v", err)
	}
	if !got.Passed {
		t.Fatal("expected passed=true")
	}
	if len(got.MessageIDs) != 1 {
		t.Fatalf("expected 1 message ID, got %d", len(got.MessageIDs))
	}
}

func TestSortTraceEvents(t *testing.T) {
	events := []TraceEvent{
		{Kind: EventDeliveryConfirmed, Timestamp: time.Date(2026, 4, 1, 0, 2, 0, 0, time.UTC)},
		{Kind: EventMessageSent, Timestamp: time.Date(2026, 4, 1, 0, 0, 0, 0, time.UTC)},
		{Kind: EventRelaySubmitted, Timestamp: time.Date(2026, 4, 1, 0, 1, 0, 0, time.UTC)},
	}
	SortTraceEvents(events)
	if events[0].Kind != EventMessageSent {
		t.Fatalf("expected first event to be message_sent, got %s", events[0].Kind)
	}
	if events[2].Kind != EventDeliveryConfirmed {
		t.Fatalf("expected last event to be delivery_confirmed, got %s", events[2].Kind)
	}
}
