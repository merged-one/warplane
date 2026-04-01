package harness

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"time"
)

// EventKind enumerates the normalized event types in a Teleporter trace.
type EventKind string

const (
	EventMessageSent         EventKind = "message_sent"
	EventWarpMessageExtract  EventKind = "warp_message_extracted"
	EventSignaturesAggregated EventKind = "signatures_aggregated"
	EventRelaySubmitted      EventKind = "relay_submitted"
	EventDeliveryConfirmed   EventKind = "delivery_confirmed"
	EventExecutionFailed     EventKind = "execution_failed"
	EventRetryRequested      EventKind = "retry_requested"
	EventRetrySucceeded      EventKind = "retry_succeeded"
	EventFeeAdded            EventKind = "fee_added"
	EventReceiptsSent        EventKind = "receipts_sent"
	EventReplayBlocked       EventKind = "replay_blocked"
)

// TraceEvent is a single normalized event in a Teleporter message lifecycle.
type TraceEvent struct {
	Kind        EventKind `json:"kind"`
	Timestamp   time.Time `json:"timestamp"`
	BlockNumber uint64    `json:"blockNumber,omitempty"`
	TxHash      string    `json:"txHash,omitempty"`
	Chain       string    `json:"chain,omitempty"`
	Details     string    `json:"details,omitempty"`
}

// ChainMeta captures chain identity for a trace.
type ChainMeta struct {
	Name         string `json:"name"`
	BlockchainID string `json:"blockchainId"`
	SubnetID     string `json:"subnetId"`
	EVMChainID   uint64 `json:"evmChainId"`
}

// FeeInfo captures fee metadata when relevant.
type FeeInfo struct {
	FeeTokenAddress string `json:"feeTokenAddress,omitempty"`
	InitialAmount   string `json:"initialAmount,omitempty"`
	AddedAmount     string `json:"addedAmount,omitempty"`
	TotalAmount     string `json:"totalAmount,omitempty"`
}

// RelayerMeta captures relayer details.
type RelayerMeta struct {
	Address string `json:"address,omitempty"`
	TxHash  string `json:"txHash,omitempty"`
}

// RetryMeta captures retry-related metadata.
type RetryMeta struct {
	OriginalGasLimit uint64 `json:"originalGasLimit,omitempty"`
	RetryGasLimit    uint64 `json:"retryGasLimit,omitempty"`
	RetryTxHash      string `json:"retryTxHash,omitempty"`
}

// ExecutionOutcome describes the final execution state.
type ExecutionOutcome string

const (
	OutcomeSuccess        ExecutionOutcome = "success"
	OutcomeFailedExec     ExecutionOutcome = "failed_execution"
	OutcomeRetrySuccess   ExecutionOutcome = "retry_success"
	OutcomeReplayBlocked  ExecutionOutcome = "replay_blocked"
	OutcomeDeliveryFailed ExecutionOutcome = "delivery_failed"
)

// MessageTrace is the canonical trace artifact for a single Teleporter message.
type MessageTrace struct {
	MessageID        string           `json:"messageId"`
	Scenario         string           `json:"scenario"`
	Source           ChainMeta        `json:"source"`
	Destination      ChainMeta        `json:"destination"`
	Sender           string           `json:"sender"`
	Recipient        string           `json:"recipient"`
	SourceTxHash     string           `json:"sourceTxHash"`
	DestinationTxHash string          `json:"destinationTxHash,omitempty"`
	Timestamps       TraceTimestamps  `json:"timestamps"`
	Events           []TraceEvent     `json:"events"`
	Relayer          *RelayerMeta     `json:"relayer,omitempty"`
	Fee              *FeeInfo         `json:"fee,omitempty"`
	Execution        ExecutionOutcome `json:"execution"`
	Retry            *RetryMeta       `json:"retry,omitempty"`
	RawRefs          []string         `json:"rawRefs,omitempty"`
}

// TraceTimestamps captures the wall-clock and block-time bookends.
type TraceTimestamps struct {
	SendTime    time.Time `json:"sendTime"`
	ReceiveTime time.Time `json:"receiveTime,omitempty"`
	BlockSend   uint64    `json:"blockSend"`
	BlockRecv   uint64    `json:"blockRecv,omitempty"`
}

// TraceIndex is the top-level index written to artifacts/traces/index.json.
type TraceIndex struct {
	GeneratedAt time.Time         `json:"generatedAt"`
	Traces      []TraceIndexEntry `json:"traces"`
}

// TraceIndexEntry is one row in the trace index.
type TraceIndexEntry struct {
	MessageID string `json:"messageId"`
	Scenario  string `json:"scenario"`
	File      string `json:"file"`
	Execution ExecutionOutcome `json:"execution"`
}

// ScenarioRun is the per-scenario run artifact.
type ScenarioRun struct {
	Scenario    string    `json:"scenario"`
	StartedAt   time.Time `json:"startedAt"`
	CompletedAt time.Time `json:"completedAt"`
	Passed      bool      `json:"passed"`
	MessageIDs  []string  `json:"messageIds"`
	TraceFiles  []string  `json:"traceFiles"`
	Error       string    `json:"error,omitempty"`
}

// DeterministicMessageID produces a stable message ID from scenario name and
// sequence number, suitable for golden fixture comparison.
func DeterministicMessageID(scenario string, seq int) string {
	h := sha256.New()
	h.Write([]byte(fmt.Sprintf("warplane:%s:%d", scenario, seq)))
	return hex.EncodeToString(h.Sum(nil))[:64]
}

// WriteTrace writes a single MessageTrace to artifacts/traces/<messageId>.json.
func WriteTrace(trace *MessageTrace) error {
	dir := filepath.Join(ArtifactsDir(), "traces")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("creating traces dir: %w", err)
	}
	data, err := json.MarshalIndent(trace, "", "  ")
	if err != nil {
		return fmt.Errorf("marshalling trace: %w", err)
	}
	path := filepath.Join(dir, trace.MessageID+".json")
	return os.WriteFile(path, data, 0o644)
}

// WriteTraceIndex writes the trace index to artifacts/traces/index.json.
func WriteTraceIndex(index *TraceIndex) error {
	dir := filepath.Join(ArtifactsDir(), "traces")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("creating traces dir: %w", err)
	}
	data, err := json.MarshalIndent(index, "", "  ")
	if err != nil {
		return fmt.Errorf("marshalling trace index: %w", err)
	}
	return os.WriteFile(filepath.Join(dir, "index.json"), data, 0o644)
}

// WriteScenarioRun writes a ScenarioRun to artifacts/scenarios/<name>/run.json.
func WriteScenarioRun(run *ScenarioRun) error {
	dir := filepath.Join(ArtifactsDir(), "scenarios", run.Scenario)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("creating scenario dir: %w", err)
	}
	data, err := json.MarshalIndent(run, "", "  ")
	if err != nil {
		return fmt.Errorf("marshalling scenario run: %w", err)
	}
	return os.WriteFile(filepath.Join(dir, "run.json"), data, 0o644)
}

// ReadTraceIndex reads the trace index from artifacts/traces/index.json.
func ReadTraceIndex() (*TraceIndex, error) {
	path := filepath.Join(ArtifactsDir(), "traces", "index.json")
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("reading trace index: %w", err)
	}
	var idx TraceIndex
	if err := json.Unmarshal(data, &idx); err != nil {
		return nil, fmt.Errorf("unmarshalling trace index: %w", err)
	}
	return &idx, nil
}

// ReadTrace reads a single trace by messageId from the artifacts directory.
func ReadTrace(messageID string) (*MessageTrace, error) {
	path := filepath.Join(ArtifactsDir(), "traces", messageID+".json")
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("reading trace %s: %w", messageID, err)
	}
	var trace MessageTrace
	if err := json.Unmarshal(data, &trace); err != nil {
		return nil, fmt.Errorf("unmarshalling trace: %w", err)
	}
	return &trace, nil
}

// ReadScenarioRun reads a scenario run artifact.
func ReadScenarioRun(scenario string) (*ScenarioRun, error) {
	path := filepath.Join(ArtifactsDir(), "scenarios", scenario, "run.json")
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("reading scenario run: %w", err)
	}
	var run ScenarioRun
	if err := json.Unmarshal(data, &run); err != nil {
		return nil, fmt.Errorf("unmarshalling scenario run: %w", err)
	}
	return &run, nil
}

// SortTraceEvents sorts events by timestamp for deterministic output.
func SortTraceEvents(events []TraceEvent) {
	sort.Slice(events, func(i, j int) bool {
		return events[i].Timestamp.Before(events[j].Timestamp)
	})
}
