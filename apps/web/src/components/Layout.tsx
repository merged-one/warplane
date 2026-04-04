import { useState, useCallback } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAutoRefresh, useTz } from "../hooks.js";
import { search as apiSearch } from "../api.js";
import type { SearchResponse } from "../api.js";

const NAV_ITEMS = [
  { to: "/", label: "Overview" },
  { to: "/traces", label: "Traces" },
  { to: "/failures", label: "Failures" },
  { to: "/relayer", label: "Relayer" },
  { to: "/scenarios", label: "Scenarios" },
  { to: "/docs", label: "Docs" },
];

const REFRESH_OPTIONS = [
  { label: "Off", value: 0 },
  { label: "10s", value: 10_000 },
  { label: "30s", value: 30_000 },
  { label: "60s", value: 60_000 },
];

export function Layout() {
  const { interval, setInterval } = useAutoRefresh();
  const { tz, setTz } = useTz();
  const navigate = useNavigate();

  // Search state
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [showResults, setShowResults] = useState(false);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 1) {
      setResults(null);
      setShowResults(false);
      return;
    }
    try {
      const res = await apiSearch(q, 10);
      setResults(res);
      setShowResults(true);
    } catch {
      setResults(null);
    }
  }, []);

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      doSearch(query);
    }
    if (e.key === "Escape") {
      setShowResults(false);
    }
  }

  function navigateToResult(path: string) {
    setShowResults(false);
    setQuery("");
    navigate(path);
  }

  const [menuOpen, setMenuOpen] = useState(false);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <div className="layout">
      <header className="topbar">
        <a href="/" className="topbar-brand">
          <img src="/warplane-logo.svg" alt="Warplane" className="topbar-logo" />
        </a>
        <button
          className="topbar-hamburger"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <span />
          <span />
          <span />
        </button>
        <div className={`topbar-menu${menuOpen ? " open" : ""}`}>
          <nav className="topbar-nav">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `topbar-link${isActive ? " active" : ""}`}
                end={item.to === "/"}
                onClick={closeMenu}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="topbar-search">
            <input
              type="text"
              placeholder="Search... (Enter)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              onBlur={() => setTimeout(() => setShowResults(false), 200)}
              className="input search-input"
            />
            {showResults && results && (
              <div className="search-dropdown">
                {results.traces.length === 0 &&
                  results.chains.length === 0 &&
                  results.scenarios.length === 0 && <div className="search-empty">No results</div>}
                {results.traces.map((t) => (
                  <button
                    key={t.messageId}
                    className="search-item"
                    onMouseDown={() => navigateToResult(`/traces/${t.messageId}`)}
                  >
                    <span className="search-type">trace</span>
                    <span className="mono">{t.messageId.slice(0, 16)}...</span>
                    <span className="muted">{t.scenario}</span>
                  </button>
                ))}
                {results.scenarios.map((s) => (
                  <button
                    key={s.scenario}
                    className="search-item"
                    onMouseDown={() => navigateToResult(`/traces?scenario=${s.scenario}`)}
                  >
                    <span className="search-type">scenario</span>
                    <span>{s.scenario}</span>
                  </button>
                ))}
                {results.chains.map((c) => (
                  <button
                    key={c.blockchainId}
                    className="search-item"
                    onMouseDown={() => navigateToResult(`/traces?chain=${c.blockchainId}`)}
                  >
                    <span className="search-type">chain</span>
                    <span>{c.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="topbar-controls">
            <select
              className="topbar-select"
              value={tz}
              onChange={(e) => setTz(e.target.value as "local" | "utc")}
              title="Timezone"
            >
              <option value="local">Local TZ</option>
              <option value="utc">UTC</option>
            </select>
            <select
              className="topbar-select"
              value={interval}
              onChange={(e) => setInterval(Number(e.target.value))}
              title="Auto-refresh"
            >
              {REFRESH_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <span className="topbar-tag">
            {interval ? `refresh ${interval / 1000}s` : "local dev"}
          </span>
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
      <footer className="site-footer">
        <span className="footer-brand">
          <img src="/logo-icon.svg" alt="" className="footer-icon" />
          Built by{" "}
          <a href="https://merged.one" target="_blank" rel="noopener noreferrer">
            Merged.One
          </a>
        </span>
        <span className="footer-sep" />
        <span className="footer-avalanche">Powered by Avalanche</span>
      </footer>
    </div>
  );
}
