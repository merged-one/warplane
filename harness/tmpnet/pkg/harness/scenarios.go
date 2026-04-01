package harness

import (
	"fmt"
	"time"
)

// ScenarioContext holds shared state for running a Teleporter scenario
// against either a live tmpnet or in deterministic/fixture mode.
type ScenarioContext struct {
	Network   *NetworkInfo
	BaseTime  time.Time
	BaseBlock uint64
	Traces    []*MessageTrace
	Runs      []*ScenarioRun
}

// NewScenarioContext creates a context seeded with deterministic base values.
func NewScenarioContext(net *NetworkInfo) *ScenarioContext {
	return &ScenarioContext{
		Network:   net,
		BaseTime:  time.Date(2026, 4, 1, 0, 0, 0, 0, time.UTC),
		BaseBlock: 100,
	}
}

// SourceMeta returns ChainMeta for the source L1.
func (sc *ScenarioContext) SourceMeta() ChainMeta {
	return ChainMeta{
		Name:         sc.Network.Source.Name,
		BlockchainID: sc.Network.Source.BlockchainID,
		SubnetID:     sc.Network.Source.SubnetID,
		EVMChainID:   uint64(sc.Network.Source.EVMChainID.Int64()),
	}
}

// DestMeta returns ChainMeta for the destination L1.
func (sc *ScenarioContext) DestMeta() ChainMeta {
	return ChainMeta{
		Name:         sc.Network.Destination.Name,
		BlockchainID: sc.Network.Destination.BlockchainID,
		SubnetID:     sc.Network.Destination.SubnetID,
		EVMChainID:   uint64(sc.Network.Destination.EVMChainID.Int64()),
	}
}

// deterministicTxHash produces a stable fake tx hash for golden fixtures.
func deterministicTxHash(scenario string, chain string, seq int) string {
	return fmt.Sprintf("0x%s", DeterministicMessageID(
		fmt.Sprintf("%s:%s:tx:%d", scenario, chain, seq), 0,
	))
}

// deterministicAddress produces a stable fake address.
func deterministicAddress(role string) string {
	h := DeterministicMessageID(role, 0)
	return "0x" + h[:40]
}

// SimulateSend models a cross-chain send and returns the trace events and metadata.
func (sc *ScenarioContext) SimulateSend(scenario string, seq int) *MessageTrace {
	msgID := DeterministicMessageID(scenario, seq)
	srcTx := deterministicTxHash(scenario, "source", seq)
	sender := deterministicAddress("sender")
	recipient := deterministicAddress("receiver")
	t0 := sc.BaseTime.Add(time.Duration(seq) * time.Minute)
	block := sc.BaseBlock + uint64(seq*10)

	trace := &MessageTrace{
		MessageID:    msgID,
		Scenario:     scenario,
		Source:       sc.SourceMeta(),
		Destination:  sc.DestMeta(),
		Sender:       sender,
		Recipient:    recipient,
		SourceTxHash: srcTx,
		Timestamps: TraceTimestamps{
			SendTime:  t0,
			BlockSend: block,
		},
		Events: []TraceEvent{
			{
				Kind:        EventMessageSent,
				Timestamp:   t0,
				BlockNumber: block,
				TxHash:      srcTx,
				Chain:       sc.Network.Source.Name,
				Details:     fmt.Sprintf("TeleporterMessenger.sendCrossChainMessage seq=%d", seq),
			},
		},
		Execution: OutcomeSuccess,
		RawRefs:   []string{srcTx},
	}
	return trace
}

// SimulateExtractWarp appends the warp extraction event.
func (sc *ScenarioContext) SimulateExtractWarp(trace *MessageTrace, seq int) {
	t := sc.BaseTime.Add(time.Duration(seq)*time.Minute + 5*time.Second)
	trace.Events = append(trace.Events, TraceEvent{
		Kind:      EventWarpMessageExtract,
		Timestamp: t,
		Chain:     trace.Source.Name,
		Details:   "warp message extracted from receipt logs",
	})
}

// SimulateAggregateSignatures appends the signature aggregation event.
func (sc *ScenarioContext) SimulateAggregateSignatures(trace *MessageTrace, seq int) {
	t := sc.BaseTime.Add(time.Duration(seq)*time.Minute + 10*time.Second)
	trace.Events = append(trace.Events, TraceEvent{
		Kind:      EventSignaturesAggregated,
		Timestamp: t,
		Details:   "quorum signatures aggregated via signature-aggregator",
	})
}

// SimulateRelay appends relay and delivery events, returns the destination tx hash.
func (sc *ScenarioContext) SimulateRelay(trace *MessageTrace, seq int) string {
	destTx := deterministicTxHash(trace.Scenario, "dest", seq)
	tRelay := sc.BaseTime.Add(time.Duration(seq)*time.Minute + 15*time.Second)
	tConfirm := sc.BaseTime.Add(time.Duration(seq)*time.Minute + 20*time.Second)
	destBlock := sc.BaseBlock + uint64(seq*10) + 5

	trace.DestinationTxHash = destTx
	trace.Timestamps.ReceiveTime = tConfirm
	trace.Timestamps.BlockRecv = destBlock
	trace.Relayer = &RelayerMeta{
		Address: deterministicAddress("relayer"),
		TxHash:  destTx,
	}
	trace.Events = append(trace.Events,
		TraceEvent{
			Kind:        EventRelaySubmitted,
			Timestamp:   tRelay,
			BlockNumber: destBlock,
			TxHash:      destTx,
			Chain:       trace.Destination.Name,
			Details:     "receiveCrossChainMessage submitted with warp predicate",
		},
		TraceEvent{
			Kind:        EventDeliveryConfirmed,
			Timestamp:   tConfirm,
			BlockNumber: destBlock,
			TxHash:      destTx,
			Chain:       trace.Destination.Name,
			Details:     "MessageReceived == true",
		},
	)
	trace.RawRefs = append(trace.RawRefs, destTx)
	return destTx
}

// SimulateFailedExecution marks execution as failed with low gas.
func (sc *ScenarioContext) SimulateFailedExecution(trace *MessageTrace, seq int, gasLimit uint64) string {
	destTx := deterministicTxHash(trace.Scenario, "dest-fail", seq)
	tRelay := sc.BaseTime.Add(time.Duration(seq)*time.Minute + 15*time.Second)
	tFail := sc.BaseTime.Add(time.Duration(seq)*time.Minute + 20*time.Second)
	destBlock := sc.BaseBlock + uint64(seq*10) + 5

	trace.DestinationTxHash = destTx
	trace.Timestamps.ReceiveTime = tFail
	trace.Timestamps.BlockRecv = destBlock
	trace.Relayer = &RelayerMeta{
		Address: deterministicAddress("relayer"),
		TxHash:  destTx,
	}
	trace.Execution = OutcomeFailedExec
	trace.Retry = &RetryMeta{OriginalGasLimit: gasLimit}
	trace.Events = append(trace.Events,
		TraceEvent{
			Kind:        EventRelaySubmitted,
			Timestamp:   tRelay,
			BlockNumber: destBlock,
			TxHash:      destTx,
			Chain:       trace.Destination.Name,
			Details:     "receiveCrossChainMessage submitted",
		},
		TraceEvent{
			Kind:        EventExecutionFailed,
			Timestamp:   tFail,
			BlockNumber: destBlock,
			TxHash:      destTx,
			Chain:       trace.Destination.Name,
			Details:     fmt.Sprintf("execution failed: RequiredGasLimit=%d insufficient", gasLimit),
		},
	)
	trace.RawRefs = append(trace.RawRefs, destTx)
	return destTx
}

// SimulateRetry appends retry events and marks execution as retry_success.
func (sc *ScenarioContext) SimulateRetry(trace *MessageTrace, seq int, retryGas uint64) {
	retryTx := deterministicTxHash(trace.Scenario, "retry", seq)
	tRetry := sc.BaseTime.Add(time.Duration(seq)*time.Minute + 30*time.Second)
	tSuccess := sc.BaseTime.Add(time.Duration(seq)*time.Minute + 35*time.Second)
	retryBlock := sc.BaseBlock + uint64(seq*10) + 10

	trace.Retry.RetryGasLimit = retryGas
	trace.Retry.RetryTxHash = retryTx
	trace.Execution = OutcomeRetrySuccess
	trace.Events = append(trace.Events,
		TraceEvent{
			Kind:        EventRetryRequested,
			Timestamp:   tRetry,
			BlockNumber: retryBlock,
			TxHash:      retryTx,
			Chain:       trace.Destination.Name,
			Details:     fmt.Sprintf("retryMessageExecution gasLimit=%d", retryGas),
		},
		TraceEvent{
			Kind:        EventRetrySucceeded,
			Timestamp:   tSuccess,
			BlockNumber: retryBlock,
			TxHash:      retryTx,
			Chain:       trace.Destination.Name,
			Details:     "execution succeeded on retry",
		},
	)
	trace.RawRefs = append(trace.RawRefs, retryTx)
}

// SimulateAddFee appends a fee-added event.
func (sc *ScenarioContext) SimulateAddFee(trace *MessageTrace, seq int, initial, added string) {
	tFee := sc.BaseTime.Add(time.Duration(seq)*time.Minute + 8*time.Second)
	feeBlock := sc.BaseBlock + uint64(seq*10) + 2
	feeTx := deterministicTxHash(trace.Scenario, "fee", seq)

	trace.Fee = &FeeInfo{
		FeeTokenAddress: deterministicAddress("fee-token"),
		InitialAmount:   initial,
		AddedAmount:     added,
		TotalAmount:     added, // simplified: initial is 0
	}
	trace.Events = append(trace.Events, TraceEvent{
		Kind:        EventFeeAdded,
		Timestamp:   tFee,
		BlockNumber: feeBlock,
		TxHash:      feeTx,
		Chain:       trace.Source.Name,
		Details:     fmt.Sprintf("AddFeeAmount: initial=%s added=%s", initial, added),
	})
	trace.RawRefs = append(trace.RawRefs, feeTx)
}

// SimulateReceiptsSent appends a receipts_sent event.
func (sc *ScenarioContext) SimulateReceiptsSent(trace *MessageTrace, seq int, receiptIDs []string) {
	tReceipt := sc.BaseTime.Add(time.Duration(seq)*time.Minute + 25*time.Second)
	receiptBlock := sc.BaseBlock + uint64(seq*10) + 7
	receiptTx := deterministicTxHash(trace.Scenario, "receipt", seq)

	trace.Events = append(trace.Events, TraceEvent{
		Kind:        EventReceiptsSent,
		Timestamp:   tReceipt,
		BlockNumber: receiptBlock,
		TxHash:      receiptTx,
		Chain:       trace.Destination.Name,
		Details:     fmt.Sprintf("sendSpecifiedReceipts count=%d ids=%v", len(receiptIDs), receiptIDs),
	})
	trace.RawRefs = append(trace.RawRefs, receiptTx)
}

// SimulateReplayBlocked appends a replay_blocked event.
func (sc *ScenarioContext) SimulateReplayBlocked(trace *MessageTrace, seq int, reason string) {
	tBlock := sc.BaseTime.Add(time.Duration(seq)*time.Minute + 20*time.Second)
	blockNum := sc.BaseBlock + uint64(seq*10) + 5
	blockTx := deterministicTxHash(trace.Scenario, "replay", seq)

	trace.Execution = OutcomeReplayBlocked
	trace.Events = append(trace.Events, TraceEvent{
		Kind:        EventReplayBlocked,
		Timestamp:   tBlock,
		BlockNumber: blockNum,
		TxHash:      blockTx,
		Chain:       trace.Destination.Name,
		Details:     reason,
	})
	trace.RawRefs = append(trace.RawRefs, blockTx)
}

// CollectTrace adds a completed trace to the context and writes the artifact.
func (sc *ScenarioContext) CollectTrace(trace *MessageTrace) error {
	SortTraceEvents(trace.Events)
	sc.Traces = append(sc.Traces, trace)
	return WriteTrace(trace)
}

// FinalizeScenario writes the scenario run artifact.
func (sc *ScenarioContext) FinalizeScenario(scenario string, passed bool, errMsg string) error {
	var msgIDs, traceFiles []string
	for _, t := range sc.Traces {
		if t.Scenario == scenario {
			msgIDs = append(msgIDs, t.MessageID)
			traceFiles = append(traceFiles, t.MessageID+".json")
		}
	}
	run := &ScenarioRun{
		Scenario:    scenario,
		StartedAt:   sc.BaseTime,
		CompletedAt: sc.BaseTime.Add(5 * time.Minute),
		Passed:      passed,
		MessageIDs:  msgIDs,
		TraceFiles:  traceFiles,
		Error:       errMsg,
	}
	sc.Runs = append(sc.Runs, run)
	return WriteScenarioRun(run)
}

// WriteTraceIndexFromContext builds and writes the trace index from all collected traces.
func (sc *ScenarioContext) WriteTraceIndexFromContext() error {
	var entries []TraceIndexEntry
	for _, t := range sc.Traces {
		entries = append(entries, TraceIndexEntry{
			MessageID: t.MessageID,
			Scenario:  t.Scenario,
			File:      t.MessageID + ".json",
			Execution: t.Execution,
		})
	}
	idx := &TraceIndex{
		GeneratedAt: sc.BaseTime.Add(10 * time.Minute),
		Traces:      entries,
	}
	return WriteTraceIndex(idx)
}
