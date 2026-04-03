/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Routes, Route } from "react-router-dom";
import { AutoRefreshProvider, TzProvider } from "./hooks.js";
import { Layout } from "./components/Layout.js";
import { OverviewPage } from "./pages/OverviewPage.js";
import { TracesPage } from "./pages/TracesPage.js";
import { TraceDetailPage } from "./pages/TraceDetailPage.js";
import { FailuresPage } from "./pages/FailuresPage.js";
import { ScenariosPage } from "./pages/ScenariosPage.js";
import { DocsPage } from "./pages/DocsPage.js";
import { RelayerOpsPage } from "./pages/RelayerOpsPage.js";

// ---- Mock data ----

const mockTrace = {
  messageId: "cf6f0000000000000000000000000001",
  scenario: "basic_send_receive",
  execution: "success" as const,
  source: { name: "source", blockchainId: "abc123", subnetId: "sub1", evmChainId: 99990 },
  destination: { name: "destination", blockchainId: "def456", subnetId: "sub2", evmChainId: 99991 },
  sender: "0xSender",
  recipient: "0xRecipient",
  sourceTxHash: "0xSourceTx",
  timestamps: {
    sendTime: "2026-04-01T00:01:00Z",
    receiveTime: "2026-04-01T00:01:30Z",
    blockSend: 100,
  },
  events: [
    {
      kind: "message_sent",
      timestamp: "2026-04-01T00:01:00Z",
      chain: "source",
      blockNumber: 100,
      txHash: "0xSourceTx",
    },
    {
      kind: "delivery_confirmed",
      timestamp: "2026-04-01T00:01:30Z",
      chain: "destination",
      blockNumber: 200,
      txHash: "0xDestTx",
    },
  ],
};

const mockFailedTrace = {
  ...mockTrace,
  messageId: "cf6f0000000000000000000000000002",
  scenario: "retry_failed_execution",
  execution: "failed" as const,
  events: [
    { kind: "message_sent", timestamp: "2026-04-01T00:01:00Z", chain: "source" },
    {
      kind: "execution_failed",
      timestamp: "2026-04-01T00:01:20Z",
      chain: "destination",
      details: "Out of gas",
    },
  ],
};

function mockFetch(url: string) {
  const u = url as string;
  if (u === "/health") {
    return json({ status: "ok", uptime: 1000, traceCount: 8, demoMode: true });
  }
  if (u.includes("/chains")) {
    return json({ chains: [mockTrace.source, mockTrace.destination] });
  }
  if (u.includes("/network")) {
    return json({
      networks: [
        {
          schemaVersion: "1.0.0",
          networkId: "test",
          source: mockTrace.source,
          destination: mockTrace.destination,
        },
      ],
    });
  }
  if (u.includes("/scenarios")) {
    return json({
      scenarios: [
        {
          scenario: "basic_send_receive",
          startedAt: "2026-04-01T00:00:00Z",
          completedAt: "2026-04-01T00:02:00Z",
          passed: true,
          messageIds: [mockTrace.messageId],
          traceFiles: [],
        },
      ],
    });
  }
  if (u.includes("/stats/failures")) {
    return json({ failures: [] });
  }
  if (u.includes("/stats/latency")) {
    return json({ p50: 0, p90: 0, p99: 0, timeSeries: [] });
  }
  if (u.includes("/relayer/health/history")) {
    return json({ history: [] });
  }
  if (u.includes("/relayer/health")) {
    return json({ health: [] });
  }
  if (u.includes("/sigagg/health/history")) {
    return json({ history: [] });
  }
  if (u.includes("/sigagg/health")) {
    return json({ health: null });
  }
  if (u.includes("/pipeline/status")) {
    return json({ status: "idle", traceCount: 8, uptime: 1000 });
  }
  if (u.includes("/failures")) {
    return json({ failures: [mockFailedTrace] });
  }
  if (u.includes("/traces/") && u.includes("/raw")) {
    return json(mockTrace);
  }
  if (u.includes("/traces/") && u.includes("/timeline")) {
    return json({ messageId: mockTrace.messageId, events: mockTrace.events });
  }
  if (u.includes("/traces/cf6f")) {
    return json(mockTrace);
  }
  if (u.includes("/traces")) {
    return json({ traces: [mockTrace, mockFailedTrace], total: 2, page: 1, pageSize: 50 });
  }
  return json({ error: "not found" }, 404);
}

function json(data: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockImplementation((input) => mockFetch(input as string));
});

function renderPage(path: string) {
  return render(
    <AutoRefreshProvider>
      <TzProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<OverviewPage />} />
              <Route path="traces" element={<TracesPage />} />
              <Route path="traces/:messageId" element={<TraceDetailPage />} />
              <Route path="failures" element={<FailuresPage />} />
              <Route path="relayer" element={<RelayerOpsPage />} />
              <Route path="scenarios" element={<ScenariosPage />} />
              <Route path="docs" element={<DocsPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </TzProvider>
    </AutoRefreshProvider>,
  );
}

describe("Layout", () => {
  it("renders nav links", async () => {
    renderPage("/docs");
    expect(screen.getByText("Warplane")).toBeInTheDocument();
    expect(screen.getAllByText("Traces").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Failures").length).toBeGreaterThan(0);
  });
});

describe("OverviewPage", () => {
  it("shows trace count and chain summary", async () => {
    renderPage("/");
    await waitFor(() => {
      expect(screen.getByText("8")).toBeInTheDocument();
    });
    expect(screen.getByText("Demo mode")).toBeInTheDocument();
    expect(screen.getByText("Chain Registry")).toBeInTheDocument();
  });
});

describe("TracesPage", () => {
  it("shows trace table", async () => {
    renderPage("/traces");
    await waitFor(() => {
      expect(screen.getByText(/Showing 2 of 2/)).toBeInTheDocument();
    });
    expect(screen.getAllByText("basic_send_receive").length).toBeGreaterThan(0);
  });
});

describe("TraceDetailPage", () => {
  it("shows trace detail with timeline", async () => {
    renderPage(`/traces/${mockTrace.messageId}`);
    await waitFor(() => {
      expect(screen.getByText("Trace Detail")).toBeInTheDocument();
    });
    expect(screen.getByText("message sent")).toBeInTheDocument();
    expect(screen.getByText("delivery confirmed")).toBeInTheDocument();
  });
});

describe("FailuresPage", () => {
  it("shows failed traces with marker events", async () => {
    renderPage("/failures");
    await waitFor(() => {
      expect(screen.getByText("Failures & Anomalies")).toBeInTheDocument();
    });
    expect(screen.getByText("execution failed")).toBeInTheDocument();
  });
});

describe("ScenariosPage", () => {
  it("shows scenario runs", async () => {
    renderPage("/scenarios");
    await waitFor(() => {
      expect(screen.getByText("Scenario Runs")).toBeInTheDocument();
    });
    expect(screen.getAllByText("basic_send_receive").length).toBeGreaterThan(0);
  });
});

describe("DocsPage", () => {
  it("shows quickstart content", () => {
    renderPage("/docs");
    expect(screen.getAllByText("Docs & Quickstart").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Getting Started").length).toBeGreaterThan(0);
    expect(screen.getAllByText("API Endpoints").length).toBeGreaterThan(0);
  });
});

describe("RelayerOpsPage", () => {
  it("renders the relayer operations page", async () => {
    renderPage("/relayer");
    await waitFor(() => {
      expect(screen.getByText("Relayer Operations")).toBeInTheDocument();
    });
    expect(screen.getByText("Health Overview")).toBeInTheDocument();
    expect(screen.getByText("Failure Classification (Last 24h)")).toBeInTheDocument();
    expect(screen.getByText("Delivery Latency (Last 24h)")).toBeInTheDocument();
  });
});

describe("Navigation", () => {
  it("shows Relayer nav link", () => {
    renderPage("/docs");
    expect(screen.getAllByText("Relayer").length).toBeGreaterThan(0);
  });
});

describe("TraceDetailPage enhanced", () => {
  it("shows on-chain and off-chain tags in timeline", async () => {
    renderPage(`/traces/${mockTrace.messageId}`);
    await waitFor(() => {
      expect(screen.getByText("Trace Detail")).toBeInTheDocument();
    });
    // Both events are on-chain (2 events × 2 renders from auto-refresh = 4)
    expect(screen.getAllByText("on-chain").length).toBeGreaterThanOrEqual(2);
  });
});
