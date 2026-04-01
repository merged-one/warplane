package harness

import (
	"math/big"
	"os"
	"path/filepath"
	"testing"
)

func TestWriteAndReadNetworkInfo(t *testing.T) {
	// Use a temp directory so we don't pollute the repo.
	tmp := t.TempDir()
	t.Setenv("WARPLANE_ARTIFACTS_DIR", tmp)

	info := &NetworkInfo{
		NetworkID:         88888,
		TeleporterVersion: "v1.0.0",
		Source: L1TestInfo{
			Name:       "source",
			EVMChainID: big.NewInt(99999),
		},
		Destination: L1TestInfo{
			Name:       "destination",
			EVMChainID: big.NewInt(99998),
		},
	}

	if err := WriteNetworkInfo(info); err != nil {
		t.Fatalf("WriteNetworkInfo: %v", err)
	}

	// Verify the file exists.
	path := filepath.Join(tmp, "network", NetworkMetadataFile)
	if _, err := os.Stat(path); os.IsNotExist(err) {
		t.Fatalf("expected %s to exist", path)
	}

	// Read it back.
	got, err := ReadNetworkInfo()
	if err != nil {
		t.Fatalf("ReadNetworkInfo: %v", err)
	}
	if got.NetworkID != 88888 {
		t.Fatalf("expected network id 88888, got %d", got.NetworkID)
	}
	if got.Source.Name != "source" {
		t.Fatalf("expected source name 'source', got %s", got.Source.Name)
	}
	if got.Destination.Name != "destination" {
		t.Fatalf("expected destination name 'destination', got %s", got.Destination.Name)
	}
}

func TestArtifactsDirDefault(t *testing.T) {
	t.Setenv("WARPLANE_ARTIFACTS_DIR", "")
	if ArtifactsDir() != DefaultArtifactsDir {
		t.Fatalf("expected default artifacts dir %s, got %s", DefaultArtifactsDir, ArtifactsDir())
	}
}

func TestArtifactsDirOverride(t *testing.T) {
	t.Setenv("WARPLANE_ARTIFACTS_DIR", "/tmp/custom")
	if ArtifactsDir() != "/tmp/custom" {
		t.Fatalf("expected /tmp/custom, got %s", ArtifactsDir())
	}
}
