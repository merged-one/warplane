// Package main_test implements the deterministic Teleporter scenario tests.
// These scenarios model the full Teleporter message lifecycle and emit
// canonical trace artifacts that the control plane can ingest.
//
// When RUN_E2E is set, these run against a live tmpnet. Otherwise they run
// in deterministic/fixture mode using simulated events and produce stable
// golden artifacts suitable for committing as fixtures.
package main

import (
	"github.com/warplane/harness/tmpnet/pkg/harness"

	"github.com/onsi/ginkgo/v2"
	"github.com/onsi/gomega"
)

// scenarioCtx is populated in BeforeSuite of the main suite file.
// In fixture mode it uses the mock NetworkInfo.
var scenarioCtx *harness.ScenarioContext

var _ = ginkgo.BeforeEach(func() {
	if scenarioCtx == nil {
		scenarioCtx = harness.NewScenarioContext(networkInfo)
	}
})

// ---------------------------------------------------------------------------
// Scenario 1: basic_send_receive
// ---------------------------------------------------------------------------
var _ = ginkgo.Describe("Scenario: basic_send_receive", ginkgo.Ordered, func() {
	const scenario = "basic_send_receive"
	var trace *harness.MessageTrace

	ginkgo.It("sends a cross-chain message", func() {
		trace = scenarioCtx.SimulateSend(scenario, 0)
		gomega.Expect(trace.Events).To(gomega.HaveLen(1))
		gomega.Expect(trace.Events[0].Kind).To(gomega.Equal(harness.EventMessageSent))
	})

	ginkgo.It("extracts the warp message", func() {
		scenarioCtx.SimulateExtractWarp(trace, 0)
		gomega.Expect(trace.Events).To(gomega.HaveLen(2))
	})

	ginkgo.It("aggregates signatures", func() {
		scenarioCtx.SimulateAggregateSignatures(trace, 0)
		gomega.Expect(trace.Events).To(gomega.HaveLen(3))
	})

	ginkgo.It("relays to destination and verifies MessageReceived == true", func() {
		scenarioCtx.SimulateRelay(trace, 0)
		gomega.Expect(trace.Events).To(gomega.HaveLen(5))
		gomega.Expect(trace.Execution).To(gomega.Equal(harness.OutcomeSuccess))
		gomega.Expect(trace.DestinationTxHash).NotTo(gomega.BeEmpty())

		// Verify delivery_confirmed event exists
		var confirmed bool
		for _, e := range trace.Events {
			if e.Kind == harness.EventDeliveryConfirmed {
				confirmed = true
			}
		}
		gomega.Expect(confirmed).To(gomega.BeTrue(), "expected delivery_confirmed event")
	})

	ginkgo.It("writes trace artifact", func() {
		err := scenarioCtx.CollectTrace(trace)
		gomega.Expect(err).NotTo(gomega.HaveOccurred())

		err = scenarioCtx.FinalizeScenario(scenario, true, "")
		gomega.Expect(err).NotTo(gomega.HaveOccurred())
	})
})

// ---------------------------------------------------------------------------
// Scenario 2: add_fee
// ---------------------------------------------------------------------------
var _ = ginkgo.Describe("Scenario: add_fee", ginkgo.Ordered, func() {
	const scenario = "add_fee"
	var trace *harness.MessageTrace

	ginkgo.It("sends a message with zero initial fee", func() {
		trace = scenarioCtx.SimulateSend(scenario, 1)
		gomega.Expect(trace.Events).To(gomega.HaveLen(1))
	})

	ginkgo.It("calls AddFeeAmount and captures fee_added event", func() {
		scenarioCtx.SimulateAddFee(trace, 1, "0", "1000000000000000000")
		gomega.Expect(trace.Fee).NotTo(gomega.BeNil())
		gomega.Expect(trace.Fee.InitialAmount).To(gomega.Equal("0"))
		gomega.Expect(trace.Fee.AddedAmount).To(gomega.Equal("1000000000000000000"))

		var feeEvent bool
		for _, e := range trace.Events {
			if e.Kind == harness.EventFeeAdded {
				feeEvent = true
			}
		}
		gomega.Expect(feeEvent).To(gomega.BeTrue(), "expected fee_added event")
	})

	ginkgo.It("completes relay after fee addition", func() {
		scenarioCtx.SimulateExtractWarp(trace, 1)
		scenarioCtx.SimulateAggregateSignatures(trace, 1)
		scenarioCtx.SimulateRelay(trace, 1)
		gomega.Expect(trace.Execution).To(gomega.Equal(harness.OutcomeSuccess))
	})

	ginkgo.It("writes trace artifact", func() {
		err := scenarioCtx.CollectTrace(trace)
		gomega.Expect(err).NotTo(gomega.HaveOccurred())

		err = scenarioCtx.FinalizeScenario(scenario, true, "")
		gomega.Expect(err).NotTo(gomega.HaveOccurred())
	})
})

// ---------------------------------------------------------------------------
// Scenario 3: specified_receipts
// ---------------------------------------------------------------------------
var _ = ginkgo.Describe("Scenario: specified_receipts", ginkgo.Ordered, func() {
	const scenario = "specified_receipts"
	var traces []*harness.MessageTrace
	var receiptTrace *harness.MessageTrace

	ginkgo.It("sends multiple messages A -> B", func() {
		for i := 0; i < 3; i++ {
			t := scenarioCtx.SimulateSend(scenario, 2+i)
			scenarioCtx.SimulateExtractWarp(t, 2+i)
			scenarioCtx.SimulateAggregateSignatures(t, 2+i)
			scenarioCtx.SimulateRelay(t, 2+i)
			traces = append(traces, t)
		}
		gomega.Expect(traces).To(gomega.HaveLen(3))
		for _, t := range traces {
			gomega.Expect(t.Execution).To(gomega.Equal(harness.OutcomeSuccess))
		}
	})

	ginkgo.It("calls SendSpecifiedReceipts from B -> A", func() {
		// The receipt message itself is a new cross-chain message B -> A
		receiptTrace = scenarioCtx.SimulateSend(scenario+"/receipts", 5)
		// Swap source/dest to model B -> A direction
		receiptTrace.Source, receiptTrace.Destination = receiptTrace.Destination, receiptTrace.Source

		var receiptIDs []string
		for _, t := range traces {
			receiptIDs = append(receiptIDs, t.MessageID[:16])
		}
		scenarioCtx.SimulateReceiptsSent(receiptTrace, 5, receiptIDs)

		var receiptEvent bool
		for _, e := range receiptTrace.Events {
			if e.Kind == harness.EventReceiptsSent {
				receiptEvent = true
			}
		}
		gomega.Expect(receiptEvent).To(gomega.BeTrue(), "expected receipts_sent event")
	})

	ginkgo.It("writes trace artifacts", func() {
		for _, t := range traces {
			err := scenarioCtx.CollectTrace(t)
			gomega.Expect(err).NotTo(gomega.HaveOccurred())
		}
		err := scenarioCtx.CollectTrace(receiptTrace)
		gomega.Expect(err).NotTo(gomega.HaveOccurred())

		err = scenarioCtx.FinalizeScenario(scenario, true, "")
		gomega.Expect(err).NotTo(gomega.HaveOccurred())
	})
})

// ---------------------------------------------------------------------------
// Scenario 4: retry_failed_execution
// ---------------------------------------------------------------------------
var _ = ginkgo.Describe("Scenario: retry_failed_execution", ginkgo.Ordered, func() {
	const scenario = "retry_failed_execution"
	var trace *harness.MessageTrace

	ginkgo.It("sends a message with too-low RequiredGasLimit", func() {
		trace = scenarioCtx.SimulateSend(scenario, 6)
		scenarioCtx.SimulateExtractWarp(trace, 6)
		scenarioCtx.SimulateAggregateSignatures(trace, 6)
		gomega.Expect(trace.Events).To(gomega.HaveLen(3))
	})

	ginkgo.It("delivery succeeds but execution fails", func() {
		scenarioCtx.SimulateFailedExecution(trace, 6, 21000)
		gomega.Expect(trace.Execution).To(gomega.Equal(harness.OutcomeFailedExec))

		var failEvent bool
		for _, e := range trace.Events {
			if e.Kind == harness.EventExecutionFailed {
				failEvent = true
			}
		}
		gomega.Expect(failEvent).To(gomega.BeTrue(), "expected execution_failed event")
	})

	ginkgo.It("calls RetryMessageExecution with enough gas", func() {
		scenarioCtx.SimulateRetry(trace, 6, 200000)
		gomega.Expect(trace.Execution).To(gomega.Equal(harness.OutcomeRetrySuccess))
		gomega.Expect(trace.Retry).NotTo(gomega.BeNil())
		gomega.Expect(trace.Retry.OriginalGasLimit).To(gomega.Equal(uint64(21000)))
		gomega.Expect(trace.Retry.RetryGasLimit).To(gomega.Equal(uint64(200000)))
	})

	ginkgo.It("writes trace artifact", func() {
		err := scenarioCtx.CollectTrace(trace)
		gomega.Expect(err).NotTo(gomega.HaveOccurred())

		err = scenarioCtx.FinalizeScenario(scenario, true, "")
		gomega.Expect(err).NotTo(gomega.HaveOccurred())
	})
})

// ---------------------------------------------------------------------------
// Scenario 5: replay_or_duplicate_blocked
// ---------------------------------------------------------------------------
var _ = ginkgo.Describe("Scenario: replay_or_duplicate_blocked", ginkgo.Ordered, func() {
	const scenario = "replay_or_duplicate_blocked"
	var trace *harness.MessageTrace

	ginkgo.It("sends a message and delivers it successfully first", func() {
		trace = scenarioCtx.SimulateSend(scenario, 7)
		scenarioCtx.SimulateExtractWarp(trace, 7)
		scenarioCtx.SimulateAggregateSignatures(trace, 7)
		scenarioCtx.SimulateRelay(trace, 7)
		gomega.Expect(trace.Execution).To(gomega.Equal(harness.OutcomeSuccess))
	})

	ginkgo.It("attempts duplicate delivery and captures replay_blocked", func() {
		// Model the duplicate attempt: same message, replay blocked
		dupTrace := scenarioCtx.SimulateSend(scenario+"/duplicate", 8)
		dupTrace.MessageID = trace.MessageID // same message ID
		scenarioCtx.SimulateExtractWarp(dupTrace, 8)
		scenarioCtx.SimulateAggregateSignatures(dupTrace, 8)
		scenarioCtx.SimulateReplayBlocked(dupTrace, 8, "message already delivered: duplicate messageId")

		gomega.Expect(dupTrace.Execution).To(gomega.Equal(harness.OutcomeReplayBlocked))

		var blocked bool
		for _, e := range dupTrace.Events {
			if e.Kind == harness.EventReplayBlocked {
				blocked = true
			}
		}
		gomega.Expect(blocked).To(gomega.BeTrue(), "expected replay_blocked event")

		// Collect both traces
		err := scenarioCtx.CollectTrace(trace)
		gomega.Expect(err).NotTo(gomega.HaveOccurred())
		err = scenarioCtx.CollectTrace(dupTrace)
		gomega.Expect(err).NotTo(gomega.HaveOccurred())
	})

	ginkgo.It("writes scenario run artifact", func() {
		err := scenarioCtx.FinalizeScenario(scenario, true, "")
		gomega.Expect(err).NotTo(gomega.HaveOccurred())
	})
})

