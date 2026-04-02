/**
 * HTTP client for the local Warplane API.
 *
 * Uses native fetch (Node 20+). All methods throw on non-2xx responses
 * with a user-friendly message and surface "API not running" hints.
 */

const DEFAULT_BASE_URL = "http://localhost:3100";

export interface ApiClientOptions {
  baseUrl?: string;
}

export class ApiClient {
  readonly baseUrl: string;

  constructor(opts: ApiClientOptions = {}) {
    this.baseUrl = (opts.baseUrl ?? process.env["ICP_API_URL"] ?? DEFAULT_BASE_URL).replace(
      /\/$/,
      "",
    );
  }

  async get<T = unknown>(
    path: string,
    query?: Record<string, string | number | undefined>,
  ): Promise<T> {
    const url = new URL(path, this.baseUrl);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined) url.searchParams.set(k, String(v));
      }
    }
    return this.request<T>(url);
  }

  async post<T = unknown>(path: string, body: unknown): Promise<T> {
    const url = new URL(path, this.baseUrl);
    return this.request<T>(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  /** Check if the API is reachable. Returns health body on success, null on failure. */
  async ping(): Promise<{ status: string; traceCount: number } | null> {
    try {
      return await this.get("/health");
    } catch {
      return null;
    }
  }

  private async request<T>(url: URL, init?: RequestInit): Promise<T> {
    let res: Response;
    try {
      res = await fetch(url, { ...init, signal: AbortSignal.timeout(5_000) });
    } catch (err) {
      if (isConnectionError(err) || isTimeoutError(err)) {
        throw new ApiUnreachableError(this.baseUrl);
      }
      throw err;
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`API ${res.status}: ${text || res.statusText}`);
    }

    return (await res.json()) as T;
  }
}

export class ApiUnreachableError extends Error {
  constructor(baseUrl: string) {
    super(
      `Cannot reach the API at ${baseUrl}\n\n` +
        `  The local API server does not appear to be running.\n` +
        `  Start it with:\n\n` +
        `    pnpm dev          # dev mode with auto-reload\n` +
        `    pnpm -F api start # production build\n\n` +
        `  Or set ICP_API_URL to point to a running instance.`,
    );
    this.name = "ApiUnreachableError";
  }
}

function isConnectionError(err: unknown): boolean {
  if (err instanceof TypeError) return true; // fetch throws TypeError for network errors
  const msg = String(err);
  return msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND") || msg.includes("fetch failed");
}

function isTimeoutError(err: unknown): boolean {
  if (err && typeof err === "object" && "name" in err) {
    return (
      (err as { name: string }).name === "TimeoutError" ||
      (err as { name: string }).name === "AbortError"
    );
  }
  return false;
}
