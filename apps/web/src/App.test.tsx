/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { AutoRefreshProvider, TzProvider } from "./hooks.js";
import { Layout } from "./components/Layout.js";
import { DocsPage } from "./pages/DocsPage.js";
import { FailuresPage } from "./pages/FailuresPage.js";
import { OverviewPage } from "./pages/OverviewPage.js";
import { RelayerOpsPage } from "./pages/RelayerOpsPage.js";
import { ScenariosPage } from "./pages/ScenariosPage.js";
import { TraceDetailPage } from "./pages/TraceDetailPage.js";
import { TracesPage } from "./pages/TracesPage.js";

const mockChains = [
  {
    name: "source",
    blockchainId: "abc123",
    subnetId: "sub1",
    evmChainId: 99990,
    explorerUrl: "https://source.explorer",
  },
  {
    name: "destination",
    blockchainId: "def456",
    subnetId: "sub2",
    evmChainId: 99991,
  },
];

const mockTrace = {
  messageId: "cf6f0000000000000000000000000001",
  scenario: "basic_send_receive",
  execution: "success" as const,
  source: {
    name: "source",
    blockchainId: "abc123",
    subnetId: "sub1",
    evmChainId: 99990,
  },
  destination: {
    name: "destination",
    blockchainId: "def456",
    subnetId: "sub2",
    evmChainId: 99991,
  },
  sender: "0xSender",
  recipient: "0xRecipient",
  sourceTxHash: "0xSourceTx",
  relayTxHash: "0xRelayTx",
  destinationTxHash: "0xDestTx",
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
  sourceTxHash: "0xFailedSourceTx",
  destinationTxHash: undefined,
  relayTxHash: undefined,
  timestamps: {
    sendTime: "2026-04-01T00:02:00Z",
    receiveTime: "2026-04-01T00:02:00Z",
    blockSend: 200,
  },
  events: [
    {
      kind: "message_sent",
      timestamp: "2026-04-01T00:02:00Z",
      chain: "source",
      txHash: "0xFailedSourceTx",
    },
    {
      kind: "execution_failed",
      timestamp: "2026-04-01T00:02:20Z",
      chain: "destination",
      details: "Out of gas",
    },
  ],
};

const mockPendingTrace = {
  ...mockTrace,
  messageId: "cf6f0000000000000000000000000003",
  execution: "pending" as const,
  sourceTxHash: "0xPendingSourceTx",
  destinationTxHash: undefined,
  relayTxHash: undefined,
  timestamps: {
    sendTime: "2026-04-01T00:03:00Z",
    receiveTime: "2026-04-01T00:03:00Z",
    blockSend: 300,
  },
  events: [
    {
      kind: "message_sent",
      timestamp: "2026-04-01T00:03:00Z",
      chain: "source",
      txHash: "0xPendingSourceTx",
    },
    {
      kind: "relay_submitted",
      timestamp: "2026-04-01T00:03:20Z",
      chain: "destination",
      details: "Queued at relayer",
    },
  ],
};

const mockRetryTrace = {
  ...mockTrace,
  messageId: "cf6f0000000000000000000000000004",
  scenario: "retry_recovered",
  execution: "retry_success" as const,
  sourceTxHash: "0xRetrySourceTx",
  relayTxHash: "0xRetryRelayTx",
  destinationTxHash: "0xRetryDestTx",
  timestamps: {
    sendTime: "2026-04-01T00:04:00Z",
    receiveTime: "2026-04-01T00:04:45Z",
    blockSend: 400,
  },
  retry: {
    originalGasLimit: "150000",
    retryGasLimit: "300000",
    retryTxHash: "0xRetryRelayTx",
  },
  events: [
    {
      kind: "message_sent",
      timestamp: "2026-04-01T00:04:00Z",
      chain: "source",
      txHash: "0xRetrySourceTx",
    },
    {
      kind: "execution_failed",
      timestamp: "2026-04-01T00:04:12Z",
      chain: "destination",
      details: "Insufficient gas",
    },
    {
      kind: "retry_succeeded",
      timestamp: "2026-04-01T00:04:26Z",
      chain: "destination",
      txHash: "0xRetryRelayTx",
    },
    {
      kind: "delivery_confirmed",
      timestamp: "2026-04-01T00:04:45Z",
      chain: "destination",
      txHash: "0xRetryDestTx",
    },
  ],
};

const allTraces = [mockTrace, mockFailedTrace, mockPendingTrace, mockRetryTrace];
const tracesById = new Map(allTraces.map((trace) => [trace.messageId, trace]));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function mockFetch(url: string) {
  const requestUrl = new URL(url, "http://warplane.test");

  if (requestUrl.pathname === "/health") {
    return json({ status: "ok", uptime: 1000, traceCount: allTraces.length, demoMode: true });
  }

  if (requestUrl.pathname === "/api/v1/chains") {
    return json({ chains: mockChains });
  }

  if (requestUrl.pathname === "/api/v1/network") {
    return json({
      networks: [
        {
          schemaVersion: "1.0.0",
          networkId: "test",
          source: mockChains[0],
          destination: mockChains[1],
        },
      ],
    });
  }

  if (requestUrl.pathname === "/api/v1/scenarios") {
    return json({
      scenarios: [
        {
          scenario: "basic_send_receive",
          startedAt: "2026-04-01T00:00:00Z",
          completedAt: "2026-04-01T00:02:00Z",
          passed: true,
          messageIds: [mockTrace.messageId, mockPendingTrace.messageId],
          traceFiles: [],
        },
        {
          scenario: "retry_failed_execution",
          startedAt: "2026-04-01T00:02:00Z",
          completedAt: "2026-04-01T00:03:00Z",
          passed: false,
          messageIds: [mockFailedTrace.messageId],
          traceFiles: [],
          error: "Out of gas",
        },
        {
          scenario: "retry_recovered",
          startedAt: "2026-04-01T00:04:00Z",
          completedAt: "2026-04-01T00:05:00Z",
          passed: true,
          messageIds: [mockRetryTrace.messageId],
          traceFiles: [],
        },
      ],
    });
  }

  if (requestUrl.pathname === "/api/v1/stats/failures") {
    return json({ failures: [] });
  }

  if (requestUrl.pathname === "/api/v1/stats/latency") {
    return json({ p50: 0, p90: 0, p99: 0, timeSeries: [] });
  }

  if (requestUrl.pathname === "/api/v1/relayer/health/history") {
    return json({ history: [] });
  }

  if (requestUrl.pathname === "/api/v1/relayer/health") {
    return json({ health: [] });
  }

  if (requestUrl.pathname === "/api/v1/sigagg/health/history") {
    return json({ history: [] });
  }

  if (requestUrl.pathname === "/api/v1/sigagg/health") {
    return json({ health: null });
  }

  if (requestUrl.pathname === "/api/v1/pipeline/status") {
    return json({ status: "idle", traceCount: allTraces.length, uptime: 1000 });
  }

  if (requestUrl.pathname === "/api/v1/failures") {
    return json({
      failures: allTraces.filter((trace) =>
        ["failed", "replay_blocked", "pending"].includes(trace.execution),
      ),
    });
  }

  if (requestUrl.pathname === "/api/v1/search") {
    return json({
      query: requestUrl.searchParams.get("q") ?? "",
      traces: [mockTrace],
      chains: mockChains,
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

  if (requestUrl.pathname === "/api/v1/traces") {
    return json(filterTraces(requestUrl));
  }

  if (requestUrl.pathname.startsWith("/api/v1/traces/")) {
    const messageId = decodeURIComponent(requestUrl.pathname.split("/")[4] ?? "");
    const trace = tracesById.get(messageId);

    if (!trace) {
      return json({ error: "not found" }, 404);
    }

    if (requestUrl.pathname.endsWith("/raw")) {
      return json(trace);
    }

    if (requestUrl.pathname.endsWith("/timeline")) {
      return json({ messageId: trace.messageId, events: trace.events });
    }

    return json(trace);
  }

  return json({ error: "not found" }, 404);
}

function filterTraces(requestUrl: URL) {
  const scenario = requestUrl.searchParams.get("scenario");
  const status = requestUrl.searchParams.get("status");
  const sourceBlockchainId = requestUrl.searchParams.get("sourceBlockchainId");
  const destinationBlockchainId = requestUrl.searchParams.get("destinationBlockchainId");
  const chain = requestUrl.searchParams.get("chain");
  const messageId = requestUrl.searchParams.get("messageId");
  const sort = requestUrl.searchParams.get("sort");
  const page = Number(requestUrl.searchParams.get("page") ?? "1");
  const pageSize = Number(requestUrl.searchParams.get("pageSize") ?? "50");

  const traces = [...allTraces]
    .filter((trace) => (scenario ? trace.scenario === scenario : true))
    .filter((trace) => (status ? trace.execution === status : true))
    .filter((trace) =>
      sourceBlockchainId ? trace.source.blockchainId === sourceBlockchainId : true,
    )
    .filter((trace) =>
      destinationBlockchainId ? trace.destination.blockchainId === destinationBlockchainId : true,
    )
    .filter((trace) =>
      chain
        ? trace.source.blockchainId === chain || trace.destination.blockchainId === chain
        : true,
    )
    .filter((trace) => (messageId ? trace.messageId.startsWith(messageId) : true))
    .sort((left, right) => {
      const delta = Date.parse(left.timestamps.sendTime) - Date.parse(right.timestamps.sendTime);
      return sort === "newest" ? -delta : delta;
    });

  const offset = (page - 1) * pageSize;

  return {
    traces: traces.slice(offset, offset + pageSize),
    total: traces.length,
    page,
    pageSize,
  };
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
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.spyOn(globalThis, "fetch").mockImplementation((input) => mockFetch(String(input)));
  Object.defineProperty(globalThis.navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

function renderPage(
  entries: string | Array<string | { pathname: string; search?: string; state?: unknown }>,
) {
  const initialEntries = Array.isArray(entries) ? entries : [entries];

  return render(
    <AutoRefreshProvider>
      <TzProvider>
        <MemoryRouter initialEntries={initialEntries}>
          <LocationProbe />
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
  it("renders nav links", () => {
    renderPage("/docs");
    expect(screen.getByAltText("Warplane")).toBeInTheDocument();
    expect(screen.getAllByText("Traces").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Failures").length).toBeGreaterThan(0);
  });
});

describe("OverviewPage", () => {
  it("shows trace count and chain summary", async () => {
    renderPage("/");
    await waitFor(() => {
      expect(screen.getByText(String(allTraces.length))).toBeInTheDocument();
    });
    expect(screen.getByText("Demo mode")).toBeInTheDocument();
    expect(screen.getByText("Chain Registry")).toBeInTheDocument();
  });
});

describe("TracesPage", () => {
  it("shows newest-first traces with the investigation toolbar", async () => {
    renderPage("/traces");
    await waitFor(() => {
      expect(screen.getByText(/Showing 4 of 4 traces/)).toBeInTheDocument();
    });
    expect(screen.getByLabelText("Scenario filter")).toBeInTheDocument();
    expect(screen.getByLabelText("Source chain filter")).toBeInTheDocument();
    expect(screen.getByLabelText("Destination chain filter")).toBeInTheDocument();
    expect(screen.getByLabelText("Message ID filter")).toBeInTheDocument();
    expect(screen.getAllByText("retry_recovered").length).toBeGreaterThan(0);
  });

  it("syncs filters into the URL and resets pagination", async () => {
    renderPage("/traces?page=2");

    await waitFor(() => {
      expect(screen.getByText(/Showing/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Pending" }));
    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/traces?status=pending");
    });

    fireEvent.change(screen.getByLabelText("Source chain filter"), {
      target: { value: "abc123" },
    });
    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("sourceBlockchainId=abc123");
    });

    fireEvent.change(screen.getByLabelText("Message ID filter"), {
      target: { value: mockPendingTrace.messageId },
    });

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent(
        `messageId=${mockPendingTrace.messageId}`,
      );
    });
  });

  it("shows active filters and clears them", async () => {
    renderPage(
      `/traces?status=pending&scenario=basic_send_receive&sourceBlockchainId=abc123&messageId=${mockPendingTrace.messageId}`,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Status: Pending/ })).toBeInTheDocument();
    });

    expect(
      screen.getByRole("button", { name: /Scenario: basic_send_receive/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Source: source/ })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: new RegExp(`Message ID: ${mockPendingTrace.messageId}`) }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/traces");
    });
    expect(screen.queryByRole("button", { name: /Status: Pending/ })).not.toBeInTheDocument();
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

  it("preserves filtered return navigation", async () => {
    renderPage([
      {
        pathname: `/traces/${mockPendingTrace.messageId}`,
        state: { returnTo: "/traces?status=pending&page=2" },
      },
    ]);

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /Back to Traces/ })).toBeInTheDocument();
    });

    expect(screen.getByRole("link", { name: /Back to Traces/ })).toHaveAttribute(
      "href",
      "/traces?status=pending&page=2",
    );
  });

  it("renders a delivered state summary for successful traces", async () => {
    renderPage(`/traces/${mockTrace.messageId}`);
    await waitFor(() => {
      expect(screen.getByText("Delivered")).toBeInTheDocument();
    });
  });

  it("renders an in-progress summary for pending traces", async () => {
    renderPage(`/traces/${mockPendingTrace.messageId}`);
    await waitFor(() => {
      expect(screen.getByText("In progress")).toBeInTheDocument();
    });
  });

  it("renders a failure summary for failed traces", async () => {
    renderPage(`/traces/${mockFailedTrace.messageId}`);
    await waitFor(() => {
      expect(screen.getByText("Delivery failed")).toBeInTheDocument();
    });
    expect(screen.getByText(/Latest failure detail: Out of gas/)).toBeInTheDocument();
  });

  it("renders a retry recovery summary for retry-success traces", async () => {
    renderPage(`/traces/${mockRetryTrace.messageId}`);
    await waitFor(() => {
      expect(screen.getByText("Recovered after retry")).toBeInTheDocument();
    });
  });

  it("shows explorer links only when the selected event resolves to a chain with an explorer", async () => {
    renderPage(`/traces/${mockTrace.messageId}`);
    await waitFor(() => {
      expect(screen.getByText("Trace Detail")).toBeInTheDocument();
    });

    const sourceTimelineItem = screen.getByText("message sent").closest('[role="button"]');
    expect(sourceTimelineItem).not.toBeNull();
    if (!sourceTimelineItem) throw new Error("Source timeline item missing");

    fireEvent.keyDown(sourceTimelineItem, { key: "Enter" });

    const eventPanel = screen.getByText("Event Details").closest(".event-detail-panel");
    expect(eventPanel).not.toBeNull();
    if (!eventPanel) throw new Error("Event panel missing");
    expect(within(eventPanel).getByRole("link", { name: "View on Explorer" })).toHaveAttribute(
      "href",
      "https://source.explorer/tx/0xSourceTx",
    );

    const destinationTimelineItem = screen
      .getByText("delivery confirmed")
      .closest('[role="button"]');
    expect(destinationTimelineItem).not.toBeNull();
    if (!destinationTimelineItem) throw new Error("Destination timeline item missing");

    fireEvent.keyDown(destinationTimelineItem, { key: " " });

    await waitFor(() => {
      const updatedPanel = screen.getByText("Event Details").closest(".event-detail-panel");
      expect(updatedPanel).not.toBeNull();
      if (!updatedPanel) throw new Error("Updated event panel missing");
      expect(
        within(updatedPanel).queryByRole("link", { name: "View on Explorer" }),
      ).not.toBeInTheDocument();
    });
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
  it("shows on-chain tags in the timeline", async () => {
    renderPage(`/traces/${mockTrace.messageId}`);
    await waitFor(() => {
      expect(screen.getByText("Trace Detail")).toBeInTheDocument();
    });
    expect(screen.getAllByText("on-chain").length).toBeGreaterThanOrEqual(2);
  });
});
