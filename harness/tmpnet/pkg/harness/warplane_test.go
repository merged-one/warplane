package harness

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

func TestWaitHealthyUsesCanonicalHealthEndpoint(t *testing.T) {
	var healthHits atomic.Int32
	var healthzHits atomic.Int32

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/health":
			healthHits.Add(1)
			w.WriteHeader(http.StatusOK)
		case "/healthz":
			healthzHits.Add(1)
			http.NotFound(w, r)
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	inst := &WarplaneInstance{BaseURL: server.URL}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	if err := inst.WaitHealthy(ctx); err != nil {
		t.Fatalf("WaitHealthy: %v", err)
	}

	if healthHits.Load() == 0 {
		t.Fatal("expected /health to be probed")
	}
	if healthzHits.Load() != 0 {
		t.Fatal("expected WaitHealthy to stop after successful /health probe")
	}
}

func TestWaitHealthyFallsBackToHealthz(t *testing.T) {
	var healthHits atomic.Int32
	var healthzHits atomic.Int32

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/health":
			healthHits.Add(1)
			http.NotFound(w, r)
		case "/healthz":
			healthzHits.Add(1)
			w.WriteHeader(http.StatusOK)
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	inst := &WarplaneInstance{BaseURL: server.URL}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	if err := inst.WaitHealthy(ctx); err != nil {
		t.Fatalf("WaitHealthy: %v", err)
	}

	if healthHits.Load() == 0 {
		t.Fatal("expected /health to be probed before fallback")
	}
	if healthzHits.Load() == 0 {
		t.Fatal("expected /healthz fallback to be probed")
	}
}
