import { useState, useEffect, useCallback, createContext, useContext } from "react";

/** Generic fetch hook with loading/error states and optional auto-refresh. */
export function useFetch<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
): { data: T | null; loading: boolean; error: string | null; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const { interval } = useAutoRefresh();

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetcher()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tick, ...deps]);

  // Auto-refresh via polling
  useEffect(() => {
    if (!interval) return;
    const id = window.setInterval(() => {
      setTick((t) => t + 1);
    }, interval);
    return () => window.clearInterval(id);
  }, [interval]);

  return { data, loading, error, reload };
}

// ---- Auto-refresh context ----

interface AutoRefreshState {
  interval: number; // 0 = off
  setInterval: (ms: number) => void;
}

const AutoRefreshContext = createContext<AutoRefreshState>({
  interval: 0,
  setInterval: () => {},
});

export function AutoRefreshProvider({ children }: { children: React.ReactNode }) {
  const [interval, setIntervalState] = useState(() => {
    const saved =
      typeof localStorage !== "undefined" ? localStorage.getItem("warplane:autoRefresh") : null;
    return saved ? Number(saved) : 0;
  });

  const setInterval = useCallback((ms: number) => {
    setIntervalState(ms);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("warplane:autoRefresh", String(ms));
    }
  }, []);

  return (
    <AutoRefreshContext.Provider value={{ interval, setInterval }}>
      {children}
    </AutoRefreshContext.Provider>
  );
}

export function useAutoRefresh() {
  return useContext(AutoRefreshContext);
}

// ---- Timezone context ----

type TzMode = "local" | "utc";

interface TzState {
  tz: TzMode;
  setTz: (tz: TzMode) => void;
}

const TzContext = createContext<TzState>({ tz: "local", setTz: () => {} });

export function TzProvider({ children }: { children: React.ReactNode }) {
  const [tz, setTzState] = useState<TzMode>(() => {
    const saved = typeof localStorage !== "undefined" ? localStorage.getItem("warplane:tz") : null;
    return (saved === "utc" ? "utc" : "local") as TzMode;
  });

  const setTz = useCallback((v: TzMode) => {
    setTzState(v);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("warplane:tz", v);
    }
  }, []);

  return <TzContext.Provider value={{ tz, setTz }}>{children}</TzContext.Provider>;
}

export function useTz() {
  return useContext(TzContext);
}

/** Format an ISO timestamp respecting the current timezone setting. */
export function useFormatTime() {
  const { tz } = useTz();
  return useCallback(
    (iso: string, style: "datetime" | "time" = "datetime") => {
      const d = new Date(iso);
      const opts: Intl.DateTimeFormatOptions =
        style === "time"
          ? {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              timeZone: tz === "utc" ? "UTC" : undefined,
            }
          : { dateStyle: "short", timeStyle: "medium", timeZone: tz === "utc" ? "UTC" : undefined };
      return d.toLocaleString(undefined, opts);
    },
    [tz],
  );
}
