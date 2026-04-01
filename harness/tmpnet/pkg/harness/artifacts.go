package harness

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

const (
	// DefaultArtifactsDir is the default path for test artifacts relative
	// to the harness module root.
	DefaultArtifactsDir = "artifacts"

	// NetworkMetadataFile is the filename for serialised network info.
	NetworkMetadataFile = "network.json"
)

// ArtifactsDir returns the resolved artifacts directory. If the WARPLANE_ARTIFACTS_DIR
// environment variable is set it takes precedence; otherwise the default relative
// path is used.
func ArtifactsDir() string {
	if dir := os.Getenv("WARPLANE_ARTIFACTS_DIR"); dir != "" {
		return dir
	}
	return DefaultArtifactsDir
}

// NetworkArtifactPath returns the full path to artifacts/network/network.json.
func NetworkArtifactPath() string {
	return filepath.Join(ArtifactsDir(), "network", NetworkMetadataFile)
}

// EnsureArtifactDir creates the artifacts/network directory if it does not exist.
func EnsureArtifactDir() error {
	dir := filepath.Join(ArtifactsDir(), "network")
	return os.MkdirAll(dir, 0o755)
}

// WriteNetworkInfo serialises a NetworkInfo to artifacts/network/network.json.
func WriteNetworkInfo(info *NetworkInfo) error {
	if err := EnsureArtifactDir(); err != nil {
		return fmt.Errorf("creating artifact dir: %w", err)
	}

	data, err := json.MarshalIndent(info, "", "  ")
	if err != nil {
		return fmt.Errorf("marshalling network info: %w", err)
	}

	path := NetworkArtifactPath()
	if err := os.WriteFile(path, data, 0o644); err != nil {
		return fmt.Errorf("writing %s: %w", path, err)
	}
	return nil
}

// ReadNetworkInfo reads a previously-written NetworkInfo from the artifact path.
func ReadNetworkInfo() (*NetworkInfo, error) {
	path := NetworkArtifactPath()
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("reading %s: %w", path, err)
	}
	var info NetworkInfo
	if err := json.Unmarshal(data, &info); err != nil {
		return nil, fmt.Errorf("unmarshalling network info: %w", err)
	}
	return &info, nil
}
