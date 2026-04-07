/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { AutoRefreshProvider, TzProvider } from "./hooks.js";
import { Layout } from "./components/Layout.js";
import { shortenIdentifier } from "./components/ExpandableIdentifier.js";
import { DocsPage } from "./pages/DocsPage.js";
import { FailuresPage } from "./pages/FailuresPage.js";
import { OverviewPage } from "./pages/OverviewPage.js";
import { RelayerOpsPage } from "./pages/RelayerOpsPage.js";
import { ScenariosPage } from "./pages/ScenariosPage.js";
import { TraceDetailPage } from "./pages/TraceDetailPage.js";
import { TracesPage } from "./pages/TracesPage.js";
import {
  allTraces,
  mockFailedTrace,
  mockFetch,
  mockPendingTrace,
  mockRetryTrace,
  mockTrace,
} from "./test-utils/mockWarplaneApi.js";

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  setViewportWidth(1280);
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

function getDefinitionValue(label: string): HTMLElement {
  const term = screen.getByText(label);
  const value = term.nextElementSibling;
  if (!(value instanceof HTMLElement)) {
    throw new Error(`Definition list value missing for ${label}`);
  }
  return value;
}

function setViewportWidth(width: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width,
  });
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
  it("shows newest-first traces with the workspace layout", async () => {
    renderPage("/traces");
    await waitFor(() => {
      expect(screen.getByText(/Showing 4 of 4 traces/)).toBeInTheDocument();
    });
    expect(screen.getByTestId("trace-filter-inline")).toBeInTheDocument();
    expect(screen.getByTestId("trace-results-bar")).toBeInTheDocument();
    expect(screen.queryByTestId("trace-mobile-toolbar")).not.toBeInTheDocument();
    expect(screen.getAllByText("retry_recovered").length).toBeGreaterThan(0);
  });

  it("keeps status chips immediate while draft filters apply in one step", async () => {
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
    fireEvent.change(screen.getByLabelText("Message ID filter"), {
      target: { value: mockPendingTrace.messageId },
    });

    expect(screen.getByTestId("location")).toHaveTextContent("/traces?status=pending");

    fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));

    await waitFor(() => {
      const locationText = screen.getByTestId("location").textContent ?? "";
      expect(locationText).toContain("status=pending");
      expect(locationText).toContain("sourceBlockchainId=abc123");
      expect(locationText).toContain(`messageId=${mockPendingTrace.messageId}`);
    });
  });

  it("shows active filters, clears pills, and clears all", async () => {
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

    fireEvent.click(screen.getByRole("button", { name: /Scenario: basic_send_receive/ }));
    await waitFor(() => {
      expect(screen.getByTestId("location")).not.toHaveTextContent("scenario=");
    });

    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/traces");
    });
    expect(screen.queryByRole("button", { name: /Status: Pending/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Message ID:/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Message ID filter")).toHaveValue("");
  });

  it("preserves the legacy chain filter until a directional filter replaces it", async () => {
    renderPage("/traces?chain=abc123");

    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: /Any chain: source/,
        }),
      ).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Source chain filter"), {
      target: { value: "abc123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));

    await waitFor(() => {
      const locationText = screen.getByTestId("location").textContent ?? "";
      expect(locationText).toContain("sourceBlockchainId=abc123");
      expect(locationText).not.toContain("chain=");
    });
  });

  it("uses the mobile drawer and discards unapplied edits on close", async () => {
    setViewportWidth(768);
    renderPage("/traces?status=pending");

    await waitFor(() => {
      expect(screen.getByTestId("trace-mobile-toolbar")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Filters" }));

    await waitFor(() => {
      expect(screen.getByTestId("trace-filter-drawer")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Scenario filter"), {
      target: { value: "retry_recovered" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    await waitFor(() => {
      expect(screen.queryByTestId("trace-filter-drawer")).not.toBeInTheDocument();
    });
    expect(screen.getByTestId("location")).toHaveTextContent("/traces?status=pending");

    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    await waitFor(() => {
      expect(screen.getByTestId("trace-filter-drawer")).toBeInTheDocument();
    });
    expect(screen.getByLabelText("Scenario filter")).toHaveValue("");

    fireEvent.change(screen.getByLabelText("Scenario filter"), {
      target: { value: "retry_recovered" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));

    await waitFor(() => {
      const locationText = screen.getByTestId("location").textContent ?? "";
      expect(locationText).toContain("status=pending");
      expect(locationText).toContain("scenario=retry_recovered");
    });
    expect(screen.queryByTestId("trace-filter-drawer")).not.toBeInTheDocument();
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

  it("truncates long identifiers and expands them on demand", async () => {
    renderPage(`/traces/${mockTrace.messageId}`);
    await waitFor(() => {
      expect(screen.getByText("Trace Detail")).toBeInTheDocument();
    });

    const messageCard = screen.getByText("Message ID").closest(".card");
    expect(messageCard).not.toBeNull();
    if (!messageCard) throw new Error("Message ID card missing");

    expect(
      within(messageCard).getByText(shortenIdentifier(mockTrace.messageId)),
    ).toBeInTheDocument();
    fireEvent.click(within(messageCard).getByRole("button", { name: "Show full" }));
    expect(within(messageCard).getByText(mockTrace.messageId)).toBeInTheDocument();
    expect(within(messageCard).getByRole("button", { name: "Show less" })).toBeInTheDocument();

    const senderValue = getDefinitionValue("Sender");
    expect(within(senderValue).getByText(shortenIdentifier(mockTrace.sender))).toBeInTheDocument();
    fireEvent.click(within(senderValue).getByRole("button", { name: "Show full" }));
    expect(within(senderValue).getByText(mockTrace.sender)).toBeInTheDocument();

    const sourceTxValue = getDefinitionValue("Source Tx");
    expect(
      within(sourceTxValue).getByText(shortenIdentifier(mockTrace.sourceTxHash)),
    ).toBeInTheDocument();
    fireEvent.click(within(sourceTxValue).getByRole("button", { name: "Show full" }));
    expect(within(sourceTxValue).getByText(mockTrace.sourceTxHash)).toBeInTheDocument();
    expect(within(sourceTxValue).getByRole("link", { name: "View on Explorer" })).toHaveAttribute(
      "href",
      `https://source.explorer/tx/${mockTrace.sourceTxHash}`,
    );
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
      `https://source.explorer/tx/${mockTrace.sourceTxHash}`,
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
