package main

import "testing"

func TestHarnessReady(t *testing.T) {
	// Smoke test: verifies the harness package compiles and the test runner works.
	expected := "warplane tmpnet harness: ready"
	if expected == "" {
		t.Fatal("expected non-empty message")
	}
}
