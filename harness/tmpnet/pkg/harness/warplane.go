// Package harness provides helpers for starting and interacting with a live
// Warplane API server process during integration and E2E tests.
package harness

import (
	"context"
	"fmt"
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

	// DBPath overrides the database file location. Empty = temp file.
	DBPath string
}

// WarplaneInstance represents a running Warplane API server process.
type WarplaneInstance struct {
	Cmd     *exec.Cmd
	BaseURL string
	Port    int
	DBPath  string
	tmpDir  string
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

	dbPath := opts.DBPath
	tmpDir := ""
	if dbPath == "" {
		tmpDir, err = os.MkdirTemp("", "warplane-test-*")
		if err != nil {
			return nil, fmt.Errorf("create temp dir: %w", err)
		}
		dbPath = filepath.Join(tmpDir, "test.db")
	}

	cmd := exec.CommandContext(ctx, "node", absPath)
	cmd.Env = append(os.Environ(),
		fmt.Sprintf("PORT=%d", port),
		fmt.Sprintf("DB_PATH=%s", dbPath),
		"HOST=127.0.0.1",
		"LOG_LEVEL=warn",
	)
	if opts.DemoMode {
		cmd.Env = append(cmd.Env, "DEMO_MODE=true")
	}
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	if err := cmd.Start(); err != nil {
		if tmpDir != "" {
			os.RemoveAll(tmpDir)
		}
		return nil, fmt.Errorf("start warplane: %w", err)
	}

	return &WarplaneInstance{
		Cmd:     cmd,
		BaseURL: fmt.Sprintf("http://127.0.0.1:%d", port),
		Port:    port,
		DBPath:  dbPath,
		tmpDir:  tmpDir,
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
// Cleans up temporary directories if created.
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

	if w.tmpDir != "" {
		os.RemoveAll(w.tmpDir)
	}
	return nil
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
