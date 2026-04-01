// Package main_test implements the Ginkgo test suite for the Warplane tmpnet
// E2E harness. It manages the lifecycle of a local Avalanche network with two
// L1 subnets and Teleporter pre-deployed.
//
// The suite is gated behind the RUN_E2E environment variable. When RUN_E2E is
// not set (or empty), the suite registers but all specs are skipped, allowing
// `go test ./...` to pass without any Avalanche binaries.
package main

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/warplane/harness/tmpnet/pkg/harness"

	"github.com/onsi/ginkgo/v2"
	"github.com/onsi/gomega"
)

// Shared network state populated by BeforeSuite.
var networkInfo *harness.NetworkInfo

// e2eEnabled is true when RUN_E2E is set to a non-empty value.
var e2eEnabled bool

// flags registered via TestMain.
var (
	flagNetworkTimeout time.Duration
)

func TestMain(m *testing.M) {
	// Register E2E-specific flags before Ginkgo parses them.
	// This ensures `go test -v ./...` works even without Ginkgo CLI.
	e2eEnabled = os.Getenv("RUN_E2E") != ""

	os.Exit(m.Run())
}

func TestTeleporterSuite(t *testing.T) {
	if !e2eEnabled {
		t.Log("RUN_E2E not set — skipping E2E suite (compile-only check passed)")
		return
	}

	gomega.RegisterFailHandler(ginkgo.Fail)
	ginkgo.RunSpecs(t, "Warplane Teleporter E2E Suite")
}

// BeforeSuite creates the tmpnet network with two L1s and Teleporter.
var _ = ginkgo.BeforeSuite(func() {
	if !e2eEnabled {
		ginkgo.Skip("RUN_E2E not set")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	fmt.Fprintln(ginkgo.GinkgoWriter, "Creating tmpnet network with Teleporter...")

	var err error
	networkInfo, err = harness.CreateNetworkWithTeleporter(ctx)
	gomega.Expect(err).NotTo(gomega.HaveOccurred(), "failed to create network")

	// Write network metadata for downstream consumers.
	err = harness.WriteNetworkInfo(networkInfo)
	gomega.Expect(err).NotTo(gomega.HaveOccurred(), "failed to write network artifact")

	fmt.Fprintf(ginkgo.GinkgoWriter, "Network ready — artifact written to %s\n",
		harness.NetworkArtifactPath())
})

// AfterSuite tears down the tmpnet network.
var _ = ginkgo.AfterSuite(func() {
	if !e2eEnabled || networkInfo == nil {
		return
	}

	fmt.Fprintln(ginkgo.GinkgoWriter, "Tearing down tmpnet network...")

	// Placeholder: the real implementation will call network.Stop(ctx, log)
	// and optionally collect logs/metrics from the tmpnet data directory.
	fmt.Fprintln(ginkgo.GinkgoWriter, "Network teardown complete.")
})

// Placeholder spec — replaced by real Teleporter scenario tests in WP-104.
var _ = ginkgo.Describe("Teleporter network", func() {
	ginkgo.It("should have source and destination L1s configured", func() {
		gomega.Expect(networkInfo).NotTo(gomega.BeNil())
		gomega.Expect(networkInfo.Source.Name).To(gomega.Equal("source"))
		gomega.Expect(networkInfo.Destination.Name).To(gomega.Equal("destination"))
	})

	ginkgo.It("should write network metadata artifact", func() {
		info, err := harness.ReadNetworkInfo()
		gomega.Expect(err).NotTo(gomega.HaveOccurred())
		gomega.Expect(info.NetworkID).To(gomega.Equal(uint32(88888)))
	})
})
