package main

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/warplane/harness/tmpnet/pkg/harness"
)

// TestIngestion exercises the Warplane API server with golden fixture data.
// These tests start a real API process with DEMO_MODE enabled, which auto-seeds
// golden traces from harness/tmpnet/artifacts/ on startup. They then verify
// traces appear in the API with correct state and events.
//
// Requirements:
//   - WARPLANE_BIN env var set to the compiled API entry point, OR
//     the default path ../../apps/api/dist/index.js must exist (run 'pnpm build' first).
//   - These tests do NOT require RUN_E2E or a live tmpnet network.

func skipIfNoBinary(t *testing.T) {
	t.Helper()
	binPath := os.Getenv("WARPLANE_BIN")
	if binPath == "" {
		binPath = filepath.Join("..", "..", "apps", "api", "dist", "index.js")
	}
	absPath, err := filepath.Abs(binPath)
	if err != nil {
		t.Skipf("cannot resolve binary path: %v", err)
	}
	if _, err := os.Stat(absPath); os.IsNotExist(err) {
		t.Skipf("warplane binary not found at %s — run 'pnpm build' first", absPath)
	}
}

// startTestServer starts a Warplane API server with DEMO_MODE and waits for
// it to become healthy. The server process lives until t.Cleanup runs.
func startTestServer(t *testing.T) *harness.WarplaneInstance {
	t.Helper()

	// Use a long-lived context for the server process — it must survive
	// beyond this function's return. t.Cleanup will stop the server.
	ctx := context.Background()

	inst, err := harness.StartWarplane(ctx, harness.WarplaneOpts{
		DemoMode: true,
	})
	if err != nil {
		t.Fatalf("failed to start warplane: %v", err)
	}

	// Use a separate timeout context for the health check only.
	healthCtx, healthCancel := context.WithTimeout(ctx, 30*time.Second)
	defer healthCancel()

	if err := inst.WaitHealthy(healthCtx); err != nil {
		inst.Stop()
		t.Fatalf("warplane did not become healthy: %v", err)
	}

	t.Cleanup(func() {
		inst.Stop()
	})

	return inst
}

func TestIngestionBasicSendReceive(t *testing.T) {
	skipIfNoBinary(t)
	inst := startTestServer(t)

	// The basic_send_receive golden fixture has this messageId and execution=success.
	const messageId = "4d8580870bf0d1c30bc561d4d6039eca0750a5f62aba0578dd0b65b0b572c67c"

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	trace, err := inst.WaitForTrace(ctx, messageId, 10*time.Second)
	if err != nil {
		t.Fatalf("failed to get trace: %v", err)
	}

	if err := harness.AssertTraceState(trace, "success"); err != nil {
		t.Error(err)
	}
	if err := harness.AssertTraceEventCount(trace, 5); err != nil {
		t.Error(err)
	}
	if err := harness.AssertTraceHasEventKind(trace, "message_sent"); err != nil {
		t.Error(err)
	}
	if err := harness.AssertTraceHasEventKind(trace, "delivery_confirmed"); err != nil {
		t.Error(err)
	}

	// Verify scenario metadata
	if trace.Scenario != "basic_send_receive" {
		t.Errorf("expected scenario=basic_send_receive, got %s", trace.Scenario)
	}
}

func TestIngestionRetryFailedExecution(t *testing.T) {
	skipIfNoBinary(t)
	inst := startTestServer(t)

	// The retry_failed_execution golden fixture: execution=retry_success
	const messageId = "d76081b5c5ce046570190357aa60c2282bda4e9a8835d8ce3f62e03cf1f5616d"

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	trace, err := inst.WaitForTrace(ctx, messageId, 10*time.Second)
	if err != nil {
		t.Fatalf("failed to get trace: %v", err)
	}

	if err := harness.AssertTraceState(trace, "retry_success"); err != nil {
		t.Error(err)
	}
	if err := harness.AssertTraceHasEventKind(trace, "execution_failed"); err != nil {
		t.Error(err)
	}
	if err := harness.AssertTraceHasEventKind(trace, "retry_succeeded"); err != nil {
		t.Error(err)
	}

	if trace.Scenario != "retry_failed_execution" {
		t.Errorf("expected scenario=retry_failed_execution, got %s", trace.Scenario)
	}
}

func TestIngestionReplayBlocked(t *testing.T) {
	skipIfNoBinary(t)
	inst := startTestServer(t)

	// The replay_or_duplicate_blocked fixture has the initial send with
	// execution=success. The index also lists the same messageId as
	// replay_blocked but that's a separate scenario entry.
	const messageId = "3a076507c46f81ef9edfb61815dde398a6f198431d18b357b748c42f5e23895f"

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	// The trace should exist — demo seeding imports all fixtures.
	trace, err := inst.WaitForTrace(ctx, messageId, 10*time.Second)
	if err != nil {
		t.Fatalf("failed to get trace: %v", err)
	}

	// The trace should have message_sent and replay_blocked events
	if err := harness.AssertTraceHasEventKind(trace, "message_sent"); err != nil {
		t.Error(err)
	}

	if trace.Scenario != "replay_or_duplicate_blocked" && trace.Scenario != "replay_or_duplicate_blocked/duplicate" {
		t.Errorf("expected scenario containing replay_or_duplicate_blocked, got %s", trace.Scenario)
	}
}

func TestIngestionTracesList(t *testing.T) {
	skipIfNoBinary(t)
	inst := startTestServer(t)

	// Wait for server to be healthy and seeded — then list all traces.
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	// Wait for at least one trace to be available
	const knownId = "4d8580870bf0d1c30bc561d4d6039eca0750a5f62aba0578dd0b65b0b572c67c"
	_, err := inst.WaitForTrace(ctx, knownId, 10*time.Second)
	if err != nil {
		t.Fatalf("failed to wait for seeded trace: %v", err)
	}

	list, err := inst.ListTraces()
	if err != nil {
		t.Fatalf("failed to list traces: %v", err)
	}

	// Golden fixtures contain 8+ traces across all scenarios
	if list.Total < 5 {
		t.Errorf("expected at least 5 seeded traces, got %d", list.Total)
	}
}
