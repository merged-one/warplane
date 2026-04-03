package harness

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// TraceResponse mirrors the API response for GET /api/v1/traces/:messageId.
// Fields match the canonical MessageTrace schema from @warplane/domain.
type TraceResponse struct {
	MessageId      string           `json:"messageId"`
	Scenario       string           `json:"scenario"`
	Execution      string           `json:"execution"`
	SchemaVersion  string           `json:"schemaVersion,omitempty"`
	Source         ChainMeta        `json:"source"`
	Destination    ChainMeta        `json:"destination"`
	Sender         string           `json:"sender"`
	Recipient      string           `json:"recipient"`
	SourceTxHash   string           `json:"sourceTxHash"`
	DestTxHash     string           `json:"destinationTxHash,omitempty"`
	Timestamps     TraceTimestamps  `json:"timestamps"`
	Events         []TraceEventResp `json:"events"`
	Relayer        *RelayerMeta     `json:"relayer,omitempty"`
	Fee            *FeeInfo         `json:"fee,omitempty"`
	Retry          *RetryInfoResp   `json:"retry,omitempty"`
	RawRefs        []string         `json:"rawRefs,omitempty"`
}

// TraceEventResp mirrors a single event in the API response.
type TraceEventResp struct {
	Kind        string `json:"kind"`
	Timestamp   string `json:"timestamp"`
	BlockNumber int    `json:"blockNumber,omitempty"`
	TxHash      string `json:"txHash,omitempty"`
	Chain       string `json:"chain,omitempty"`
	Details     string `json:"details,omitempty"`
}

// RetryInfoResp mirrors the retry info in the API trace response.
type RetryInfoResp struct {
	OriginalGasLimit int    `json:"originalGasLimit,omitempty"`
	RetryGasLimit    int    `json:"retryGasLimit,omitempty"`
	RetryTxHash      string `json:"retryTxHash,omitempty"`
}

// TracesListResponse mirrors GET /api/v1/traces.
type TracesListResponse struct {
	Traces   []TraceResponse `json:"traces"`
	Total    int             `json:"total"`
	Page     int             `json:"page"`
	PageSize int             `json:"pageSize"`
}

// ImportResponse mirrors POST /api/v1/import.
type ImportResponse struct {
	ImportId  int      `json:"importId"`
	Networks  int      `json:"networks"`
	Chains    int      `json:"chains"`
	Scenarios int      `json:"scenarios"`
	Traces    int      `json:"traces"`
	Events    int      `json:"events"`
	Errors    []string `json:"errors"`
}

// WaitForTrace polls GET /api/v1/traces/:messageId until a trace appears or
// the timeout is reached. Returns the trace response on success.
func (w *WarplaneInstance) WaitForTrace(ctx context.Context, messageId string, timeout time.Duration) (*TraceResponse, error) {
	deadline := time.Now().Add(timeout)
	client := &http.Client{Timeout: 5 * time.Second}
	url := fmt.Sprintf("%s/api/v1/traces/%s", w.BaseURL, messageId)

	for {
		if time.Now().After(deadline) {
			return nil, fmt.Errorf("trace %s did not appear within %s", messageId, timeout)
		}

		trace, done, err := func() (*TraceResponse, bool, error) {
			resp, err := client.Get(url)
			if err != nil {
				return nil, false, nil // transient error, retry
			}
			defer resp.Body.Close()

			if resp.StatusCode != 200 {
				// Drain body to allow connection reuse
				_, _ = io.Copy(io.Discard, resp.Body)
				return nil, false, nil // not found yet, retry
			}

			body, err := io.ReadAll(resp.Body)
			if err != nil {
				return nil, true, fmt.Errorf("reading response body: %w", err)
			}
			var t TraceResponse
			if err := json.Unmarshal(body, &t); err != nil {
				return nil, true, fmt.Errorf("unmarshalling trace response: %w", err)
			}
			return &t, true, nil
		}()
		if err != nil {
			return nil, err
		}
		if done {
			return trace, nil
		}

		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(250 * time.Millisecond):
		}
	}
}

// GetTrace fetches a single trace by messageId (non-polling, single attempt).
func (w *WarplaneInstance) GetTrace(messageId string) (*TraceResponse, error) {
	client := &http.Client{Timeout: 5 * time.Second}
	url := fmt.Sprintf("%s/api/v1/traces/%s", w.BaseURL, messageId)

	resp, err := client.Get(url)
	if err != nil {
		return nil, fmt.Errorf("fetching trace: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == 404 {
		return nil, nil
	}
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("unexpected status %d fetching trace %s", resp.StatusCode, messageId)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("reading response body: %w", err)
	}

	var trace TraceResponse
	if err := json.Unmarshal(body, &trace); err != nil {
		return nil, fmt.Errorf("unmarshalling trace: %w", err)
	}
	return &trace, nil
}

// ListTraces fetches all traces from the API.
func (w *WarplaneInstance) ListTraces() (*TracesListResponse, error) {
	client := &http.Client{Timeout: 5 * time.Second}
	url := fmt.Sprintf("%s/api/v1/traces?pageSize=200", w.BaseURL)

	resp, err := client.Get(url)
	if err != nil {
		return nil, fmt.Errorf("fetching traces list: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("reading response body: %w", err)
	}

	var result TracesListResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("unmarshalling traces list: %w", err)
	}
	return &result, nil
}

// ImportArtifacts calls POST /api/v1/import with the given artifacts directory.
func (w *WarplaneInstance) ImportArtifacts(artifactsDir string) (*ImportResponse, error) {
	client := &http.Client{Timeout: 30 * time.Second}
	url := fmt.Sprintf("%s/api/v1/import", w.BaseURL)

	payload := fmt.Sprintf(`{"artifactsDir": %q, "sourceType": "test"}`, artifactsDir)
	resp, err := client.Post(url, "application/json", strings.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("importing artifacts: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("reading import response: %w", err)
	}

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("import failed (status %d): %s", resp.StatusCode, string(body))
	}

	var result ImportResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("unmarshalling import response: %w", err)
	}
	return &result, nil
}

// AssertTraceState checks that a trace has the expected execution state.
// Returns an error describing the mismatch if the assertion fails.
func AssertTraceState(trace *TraceResponse, expected string) error {
	if trace.Execution != expected {
		return fmt.Errorf("expected trace %s execution=%q, got %q", trace.MessageId, expected, trace.Execution)
	}
	return nil
}

// AssertTraceEventCount checks that a trace has the expected number of events.
// Returns an error describing the mismatch if the assertion fails.
func AssertTraceEventCount(trace *TraceResponse, expected int) error {
	if len(trace.Events) != expected {
		return fmt.Errorf("expected trace %s to have %d events, got %d", trace.MessageId, expected, len(trace.Events))
	}
	return nil
}

// AssertTraceHasEventKind checks that a trace contains at least one event of the given kind.
func AssertTraceHasEventKind(trace *TraceResponse, kind string) error {
	for _, e := range trace.Events {
		if e.Kind == kind {
			return nil
		}
	}
	return fmt.Errorf("trace %s has no event of kind %q", trace.MessageId, kind)
}
