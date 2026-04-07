import type { MessageTrace } from "../api.js";

export const mockChains = [
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
] as const;

export const SOURCE_TX_HASH = "0x1111111111111111111111111111111111111111111111111111111111111111";
export const RELAY_TX_HASH = "0x2222222222222222222222222222222222222222222222222222222222222222";
export const DEST_TX_HASH = "0x3333333333333333333333333333333333333333333333333333333333333333";
export const SENDER_ADDRESS = "0x111122223333444455556666777788889999AaAa";
export const RECIPIENT_ADDRESS = "0x999988887777666655554444333322221111BbBb";
export const RELAYER_ADDRESS = "0x55556666777788889999AAAAbbbbCCCCddddeeee";

export const mockTrace = {
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
  sender: SENDER_ADDRESS,
  recipient: RECIPIENT_ADDRESS,
  sourceTxHash: SOURCE_TX_HASH,
  relayTxHash: RELAY_TX_HASH,
  destinationTxHash: DEST_TX_HASH,
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
      txHash: SOURCE_TX_HASH,
    },
    {
      kind: "delivery_confirmed",
      timestamp: "2026-04-01T00:01:30Z",
      chain: "destination",
      blockNumber: 200,
      txHash: DEST_TX_HASH,
    },
  ],
  relayer: {
    address: RELAYER_ADDRESS,
    txHash: RELAY_TX_HASH,
  },
};

export const mockFailedTrace = {
  ...mockTrace,
  messageId: "cf6f0000000000000000000000000002",
  scenario: "retry_failed_execution",
  execution: "failed" as const,
  sourceTxHash: "0x4444444444444444444444444444444444444444444444444444444444444444",
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
      txHash: "0x4444444444444444444444444444444444444444444444444444444444444444",
    },
    {
      kind: "execution_failed",
      timestamp: "2026-04-01T00:02:20Z",
      chain: "destination",
      details: "Out of gas",
    },
  ],
};

export const mockPendingTrace = {
  ...mockTrace,
  messageId: "cf6f0000000000000000000000000003",
  execution: "pending" as const,
  sourceTxHash: "0x5555555555555555555555555555555555555555555555555555555555555555",
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
      txHash: "0x5555555555555555555555555555555555555555555555555555555555555555",
    },
    {
      kind: "relay_submitted",
      timestamp: "2026-04-01T00:03:20Z",
      chain: "destination",
      details: "Queued at relayer",
    },
  ],
};

export const mockRetryTrace = {
  ...mockTrace,
  messageId: "cf6f0000000000000000000000000004",
  scenario: "retry_recovered",
  execution: "retry_success" as const,
  sourceTxHash: "0x6666666666666666666666666666666666666666666666666666666666666666",
  relayTxHash: "0x7777777777777777777777777777777777777777777777777777777777777777",
  destinationTxHash: "0x8888888888888888888888888888888888888888888888888888888888888888",
  timestamps: {
    sendTime: "2026-04-01T00:04:00Z",
    receiveTime: "2026-04-01T00:04:45Z",
    blockSend: 400,
  },
  retry: {
    originalGasLimit: "150000",
    retryGasLimit: "300000",
    retryTxHash: "0x7777777777777777777777777777777777777777777777777777777777777777",
  },
  events: [
    {
      kind: "message_sent",
      timestamp: "2026-04-01T00:04:00Z",
      chain: "source",
      txHash: "0x6666666666666666666666666666666666666666666666666666666666666666",
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
      txHash: "0x7777777777777777777777777777777777777777777777777777777777777777",
    },
    {
      kind: "delivery_confirmed",
      timestamp: "2026-04-01T00:04:45Z",
      chain: "destination",
      txHash: "0x8888888888888888888888888888888888888888888888888888888888888888",
    },
  ],
};

export const allTraces: MessageTrace[] = [
  mockTrace,
  mockFailedTrace,
  mockPendingTrace,
  mockRetryTrace,
];

export const tracesById = new Map(allTraces.map((trace) => [trace.messageId, trace]));

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

export function resolveMockWarplaneApiResponse(url: string): { status: number; body: unknown } {
  const requestUrl = new URL(url, "http://warplane.test");

  if (requestUrl.pathname === "/health") {
    return {
      status: 200,
      body: { status: "ok", uptime: 1000, traceCount: allTraces.length, demoMode: true },
    };
  }

  if (requestUrl.pathname === "/api/v1/chains") {
    return { status: 200, body: { chains: mockChains } };
  }

  if (requestUrl.pathname === "/api/v1/network") {
    return {
      status: 200,
      body: {
        networks: [
          {
            schemaVersion: "1.0.0",
            networkId: "test",
            source: mockChains[0],
            destination: mockChains[1],
          },
        ],
      },
    };
  }

  if (requestUrl.pathname === "/api/v1/scenarios") {
    return {
      status: 200,
      body: {
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
      },
    };
  }

  if (requestUrl.pathname === "/api/v1/stats/failures") {
    return { status: 200, body: { failures: [] } };
  }

  if (requestUrl.pathname === "/api/v1/stats/latency") {
    return { status: 200, body: { p50: 0, p90: 0, p99: 0, timeSeries: [] } };
  }

  if (requestUrl.pathname === "/api/v1/relayer/health/history") {
    return { status: 200, body: { history: [] } };
  }

  if (requestUrl.pathname === "/api/v1/relayer/health") {
    return { status: 200, body: { health: [] } };
  }

  if (requestUrl.pathname === "/api/v1/sigagg/health/history") {
    return { status: 200, body: { history: [] } };
  }

  if (requestUrl.pathname === "/api/v1/sigagg/health") {
    return { status: 200, body: { health: null } };
  }

  if (requestUrl.pathname === "/api/v1/pipeline/status") {
    return { status: 200, body: { status: "idle", traceCount: allTraces.length, uptime: 1000 } };
  }

  if (requestUrl.pathname === "/api/v1/failures") {
    return {
      status: 200,
      body: {
        failures: allTraces.filter((trace) =>
          ["failed", "replay_blocked", "pending"].includes(trace.execution),
        ),
      },
    };
  }

  if (requestUrl.pathname === "/api/v1/search") {
    return {
      status: 200,
      body: {
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
      },
    };
  }

  if (requestUrl.pathname === "/api/v1/traces") {
    return { status: 200, body: filterTraces(requestUrl) };
  }

  if (requestUrl.pathname.startsWith("/api/v1/traces/")) {
    const messageId = decodeURIComponent(requestUrl.pathname.split("/")[4] ?? "");
    const trace = tracesById.get(messageId);

    if (!trace) {
      return { status: 404, body: { error: "not found" } };
    }

    if (requestUrl.pathname.endsWith("/raw")) {
      return { status: 200, body: trace };
    }

    if (requestUrl.pathname.endsWith("/timeline")) {
      return { status: 200, body: { messageId: trace.messageId, events: trace.events } };
    }

    return { status: 200, body: trace };
  }

  return { status: 404, body: { error: "not found" } };
}

export function mockFetch(input: string): Promise<Response> {
  const { status, body } = resolveMockWarplaneApiResponse(input);

  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}
