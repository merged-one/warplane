// Package harness provides helpers for starting and interacting with a live
// Warplane API server process during integration and E2E tests.
package harness

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"time"
)

// WarplaneOpts configures how a Warplane API server is started.
type WarplaneOpts struct {
	// BinPath is the path to the compiled API entry point.
	// Default: resolved from WARPLANE_BIN env var, or falls back to
	// ../../apps/api/dist/index.js relative to the harness directory.
	BinPath string

	// Port for the API server. 0 = pick a free port automatically.
	Port int

	// DemoMode enables golden fixture seeding on startup.
	DemoMode bool

	// DatabaseURL overrides the Postgres connection string.
	// Empty = inherit DATABASE_URL from environment.
	DatabaseURL string

	// ConfigPath is the path to a warplane YAML config file.
	// Sets WARPLANE_CONFIG env var. Empty = no config override.
	ConfigPath string
}

// WarplaneInstance represents a running Warplane API server process.
type WarplaneInstance struct {
	Cmd         *exec.Cmd
	BaseURL     string
	Port        int
	DatabaseURL string
}

// StartWarplane starts a Warplane API server as a child process.
// The caller must call Stop() to terminate the process.
func StartWarplane(ctx context.Context, opts WarplaneOpts) (*WarplaneInstance, error) {
	binPath := opts.BinPath
	if binPath == "" {
		binPath = os.Getenv("WARPLANE_BIN")
	}
	if binPath == "" {
		// Default: relative to the harness/tmpnet directory
		binPath = filepath.Join("..", "..", "apps", "api", "dist", "index.js")
	}

	absPath, err := filepath.Abs(binPath)
	if err != nil {
		return nil, fmt.Errorf("resolve bin path: %w", err)
	}
	if _, err := os.Stat(absPath); os.IsNotExist(err) {
		return nil, fmt.Errorf("warplane binary not found at %s — run 'pnpm build' first", absPath)
	}

	port := opts.Port
	if port == 0 {
		port, err = freePort()
		if err != nil {
			return nil, fmt.Errorf("find free port: %w", err)
		}
	}

	dbURL := opts.DatabaseURL
	if dbURL == "" {
		dbURL = os.Getenv("DATABASE_URL")
	}
	if dbURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required (set via WarplaneOpts.DatabaseURL or environment)")
	}

	cmd := exec.CommandContext(ctx, "node", absPath)
	cmd.Env = append(os.Environ(),
		fmt.Sprintf("PORT=%d", port),
		fmt.Sprintf("DATABASE_URL=%s", dbURL),
		"HOST=127.0.0.1",
		"LOG_LEVEL=warn",
	)
	if opts.DemoMode {
		cmd.Env = append(cmd.Env, "DEMO_MODE=true")
	}
	if opts.ConfigPath != "" {
		absConfig, err := filepath.Abs(opts.ConfigPath)
		if err != nil {
			return nil, fmt.Errorf("resolve config path: %w", err)
		}
		cmd.Env = append(cmd.Env, fmt.Sprintf("WARPLANE_CONFIG=%s", absConfig))
	}
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("start warplane: %w", err)
	}

	return &WarplaneInstance{
		Cmd:         cmd,
		BaseURL:     fmt.Sprintf("http://127.0.0.1:%d", port),
		Port:        port,
		DatabaseURL: dbURL,
	}, nil
}

// WaitHealthy polls /healthz until the server responds with 200 or the
// context is cancelled. Default timeout: 30 seconds.
func (w *WarplaneInstance) WaitHealthy(ctx context.Context) error {
	deadline, ok := ctx.Deadline()
	if !ok {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, 30*time.Second)
		defer cancel()
		deadline = time.Now().Add(30 * time.Second)
	}

	url := w.BaseURL + "/healthz"
	client := &http.Client{Timeout: 2 * time.Second}

	for {
		if time.Now().After(deadline) {
			return fmt.Errorf("warplane did not become healthy within timeout")
		}

		resp, err := client.Get(url)
		if err == nil {
			resp.Body.Close()
			if resp.StatusCode == 200 {
				return nil
			}
		}

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(200 * time.Millisecond):
		}
	}
}

// Stop sends SIGTERM to the Warplane process and waits for it to exit.
func (w *WarplaneInstance) Stop() error {
	if w.Cmd.Process != nil {
		_ = w.Cmd.Process.Signal(os.Interrupt)
		// Wait up to 5 seconds for graceful shutdown
		done := make(chan error, 1)
		go func() { done <- w.Cmd.Wait() }()
		select {
		case <-done:
		case <-time.After(5 * time.Second):
			_ = w.Cmd.Process.Kill()
			<-done
		}
	}

	return nil
}

// PipelineChainStatus describes the status of a single chain in the pipeline.
type PipelineChainStatus struct {
	ChainID   int    `json:"chainId"`
	Name      string `json:"name"`
	Mode      string `json:"mode"`
	LastBlock int64  `json:"lastBlock"`
	Error     string `json:"error,omitempty"`
}

// PipelineStatus is the response from GET /api/v1/pipeline/status.
type PipelineStatus struct {
	Status     string                `json:"status"`
	TraceCount int                   `json:"traceCount"`
	Uptime     float64               `json:"uptime"`
	Chains     []PipelineChainStatus `json:"chains"`
}

// GetPipelineStatus calls GET /api/v1/pipeline/status and returns parsed status.
func (w *WarplaneInstance) GetPipelineStatus() (*PipelineStatus, error) {
	resp, err := http.Get(w.BaseURL + "/api/v1/pipeline/status")
	if err != nil {
		return nil, fmt.Errorf("GET pipeline status: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("pipeline status returned %d: %s", resp.StatusCode, string(body))
	}

	var status PipelineStatus
	if err := json.NewDecoder(resp.Body).Decode(&status); err != nil {
		return nil, fmt.Errorf("decode pipeline status: %w", err)
	}
	return &status, nil
}

// freePort finds an available TCP port on localhost.
func freePort() (int, error) {
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return 0, err
	}
	port := l.Addr().(*net.TCPAddr).Port
	l.Close()
	return port, nil
}
