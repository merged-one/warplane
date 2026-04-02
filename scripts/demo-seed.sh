#!/usr/bin/env bash
set -euo pipefail

# ── Warplane Seeded Demo ─────────────────────────────────────────────
#
# Starts the API (with seeded golden fixtures) and the web dashboard
# so a new contributor can see the full Milestone 1 MVP immediately.
#
# No AvalancheGo binaries required — uses deterministic golden fixtures.
#
# Usage:
#   pnpm demo:seed          # or: make demo-seed
#   SKIP_BUILD=1 pnpm demo:seed   # skip build if already built

BOLD='\033[1m'
DIM='\033[2m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
RESET='\033[0m'

API_PORT="${PORT:-3100}"
WEB_PORT="${WEB_PORT:-5173}"

cleanup() {
  echo ""
  echo -e "${DIM}Shutting down…${RESET}"
  [ -n "${API_PID:-}" ] && kill "$API_PID" 2>/dev/null || true
  [ -n "${WEB_PID:-}" ] && kill "$WEB_PID" 2>/dev/null || true
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo -e "${BOLD}╔══════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║   Warplane — Seeded Demo (golden fixtures)  ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════════════╝${RESET}"
echo ""

# ── 1. Ensure dependencies ──
if [ ! -d "node_modules" ]; then
  echo -e "${CYAN}Installing dependencies…${RESET}"
  pnpm install
fi

# ── 2. Build (unless SKIP_BUILD=1) ──
if [ "${SKIP_BUILD:-}" != "1" ]; then
  echo -e "${CYAN}Building all packages…${RESET}"
  pnpm build
  echo ""
fi

# ── 3. Ensure data directory exists ──
mkdir -p data

# ── 4. Start API server (DEMO_MODE seeds golden fixtures automatically) ──
echo -e "${CYAN}Starting API server on port ${API_PORT}…${RESET}"
DEMO_MODE=true PORT="$API_PORT" node --import tsx apps/api/src/index.ts &
API_PID=$!

# Wait for API readiness
for i in $(seq 1 30); do
  if curl -sf "http://localhost:${API_PORT}/healthz" > /dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! curl -sf "http://localhost:${API_PORT}/healthz" > /dev/null 2>&1; then
  echo "ERROR: API failed to start within 30s"
  exit 1
fi
echo -e "${GREEN}API ready ✓${RESET}"

# ── 5. Start web dashboard ──
echo -e "${CYAN}Starting web dashboard on port ${WEB_PORT}…${RESET}"
pnpm --filter @warplane/web dev --port "$WEB_PORT" &
WEB_PID=$!
sleep 3
echo -e "${GREEN}Web ready ✓${RESET}"

# ── 6. Print URLs ──
echo ""
echo -e "${BOLD}════════════════════════════════════════════════${RESET}"
echo -e "${GREEN} Warplane is running!${RESET}"
echo ""
echo -e "  Dashboard:    ${BOLD}http://localhost:${WEB_PORT}${RESET}"
echo -e "  API:          ${BOLD}http://localhost:${API_PORT}${RESET}"
echo -e "  Swagger UI:   ${BOLD}http://localhost:${API_PORT}/docs${RESET}"
echo -e "  OpenAPI spec: ${BOLD}http://localhost:${API_PORT}/openapi.json${RESET}"
echo -e "  Health:       ${BOLD}http://localhost:${API_PORT}/healthz${RESET}"
echo ""
echo -e "${DIM}  Mode: seeded golden fixtures (no AvalancheGo required)${RESET}"
echo -e "${DIM}  Data: 8 Teleporter traces, 5 scenarios, 2 L1 chains${RESET}"
echo ""
echo -e "${DIM}  To switch to full tmpnet mode, see:${RESET}"
echo -e "${DIM}    docs/runbooks/full-e2e.md${RESET}"
echo ""
echo -e "${DIM}  Press Ctrl+C to stop.${RESET}"
echo -e "${BOLD}════════════════════════════════════════════════${RESET}"

# ── Wait for Ctrl+C ──
wait
