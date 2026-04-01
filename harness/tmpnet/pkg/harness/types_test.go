package harness

import (
	"math/big"
	"testing"
)

func TestL1TestInfoDefaults(t *testing.T) {
	info := L1TestInfo{
		Name:       "test-l1",
		EVMChainID: big.NewInt(12345),
	}
	if info.Name != "test-l1" {
		t.Fatalf("expected name test-l1, got %s", info.Name)
	}
	if info.EVMChainID.Int64() != 12345 {
		t.Fatalf("expected chain id 12345, got %d", info.EVMChainID.Int64())
	}
}

func TestBuildRPCURL(t *testing.T) {
	u, err := BuildRPCURL("http://127.0.0.1:9650", "abc123")
	if err != nil {
		t.Fatal(err)
	}
	expected := "http://127.0.0.1:9650/ext/bc/abc123/rpc"
	if u.String() != expected {
		t.Fatalf("expected %s, got %s", expected, u.String())
	}
}

func TestBuildWSURL(t *testing.T) {
	u, err := BuildWSURL("http://127.0.0.1:9650", "abc123")
	if err != nil {
		t.Fatal(err)
	}
	expected := "ws://127.0.0.1:9650/ext/bc/abc123/ws"
	if u.String() != expected {
		t.Fatalf("expected %s, got %s", expected, u.String())
	}
}
