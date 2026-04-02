#!/usr/bin/env bash
set -euo pipefail

# ── Warplane Repo Health Check ───────────────────────────────────────
#
# Runs all quality checks locally — the same checks that CI runs.
# Use this before opening a PR or to verify repo health.
#
# Usage:
#   pnpm run repo:check    # or: make repo-check

BOLD='\033[1m'
GREEN='\033[0;32m'
RED='\033[0;31m'
DIM='\033[2m'
RESET='\033[0m'

PASS=0
FAIL=0
ERRORS=""

step() {
  echo ""
  echo -e "${BOLD}── $1 ──${RESET}"
}

pass() {
  PASS=$((PASS + 1))
  echo -e "  ${GREEN}✓ $1${RESET}"
}

fail() {
  FAIL=$((FAIL + 1))
  ERRORS="${ERRORS}\n  - $1"
  echo -e "  ${RED}✗ $1${RESET}"
}

# ── Build ──
step "Build"
if pnpm build 2>&1; then
  pass "pnpm build"
else
  fail "pnpm build"
fi

# ── Lint ──
step "Lint"
if pnpm lint 2>&1; then
  pass "eslint"
else
  fail "eslint"
fi

# ── Typecheck ──
step "Typecheck"
if pnpm typecheck 2>&1; then
  pass "tsc -b"
else
  fail "tsc -b"
fi

# ── Format ──
step "Format"
if pnpm format:check 2>&1; then
  pass "prettier"
else
  fail "prettier"
fi

# ── Unit tests ──
step "Tests"
if pnpm test 2>&1; then
  pass "vitest + web tests"
else
  fail "vitest + web tests"
fi

# ── Go harness ──
step "Go Harness"
if [ -f "harness/tmpnet/go.mod" ]; then
  if (cd harness/tmpnet && go build ./...) 2>&1; then
    pass "go build"
  else
    fail "go build"
  fi

  if (cd harness/tmpnet && go vet ./...) 2>&1; then
    pass "go vet"
  else
    fail "go vet"
  fi

  if (cd harness/tmpnet && go test ./...) 2>&1; then
    pass "go test"
  else
    fail "go test"
  fi
else
  echo -e "  ${DIM}skipped (no Go module found)${RESET}"
fi

# ── Docs build ──
step "Docs Site"
if pnpm docs:build 2>&1; then
  pass "vitepress build"
else
  fail "vitepress build"
fi

# ── LLMs generation ──
step "LLMs Generation"
pnpm docs:llms 2>&1
if git diff --quiet llms.txt llms-full.txt docs/ai/context-map.json 2>/dev/null; then
  pass "llms.txt up to date"
else
  fail "llms.txt out of date — run 'pnpm docs:llms' and commit"
fi

# ── ADR validation ──
step "ADR Validation"
adr_ok=true
required_sections=(
  "## Status"
  "## Date"
  "## Context and Problem Statement"
  "## Decision Drivers"
  "## Considered Options"
  "## Decision Outcome"
)

for adr in docs/decisions/[0-9][0-9][0-9][0-9]-*.md; do
  [ -f "$adr" ] || continue
  for section in "${required_sections[@]}"; do
    if ! grep -q "^${section}$" "$adr"; then
      fail "ADR $(basename "$adr"): missing '${section}'"
      adr_ok=false
    fi
  done
done

if $adr_ok; then
  pass "ADR structure valid"
fi

# ── Docs link check (lightweight) ──
step "Docs Links"
link_ok=true
while IFS= read -r md_file; do
  # Check for broken relative links to files that should exist
  while IFS= read -r link; do
    target=$(dirname "$md_file")/"$link"
    # Remove any anchor
    target="${target%%#*}"
    # Remove query params
    target="${target%%\?*}"
    if [ -n "$target" ] && [ ! -e "$target" ] && [ ! -e "${target}.md" ]; then
      fail "Broken link in $(basename "$md_file"): $link"
      link_ok=false
    fi
  done < <(grep -oP '\[.*?\]\(\K[^)]+' "$md_file" 2>/dev/null | grep -v '^http' | grep -v '^#' || true)
done < <(find docs -name '*.md' -not -path '*/node_modules/*' -not -path '*/.vitepress/*' 2>/dev/null)

if $link_ok; then
  pass "No broken relative doc links"
fi

# ── Summary ──
echo ""
echo -e "${BOLD}════════════════════════════════════════════════${RESET}"
TOTAL=$((PASS + FAIL))
if [ "$FAIL" -eq 0 ]; then
  echo -e "${GREEN}All $TOTAL checks passed ✓${RESET}"
  echo -e "${BOLD}════════════════════════════════════════════════${RESET}"
  exit 0
else
  echo -e "${RED}$FAIL of $TOTAL checks failed:${RESET}"
  echo -e "$ERRORS"
  echo -e "${BOLD}════════════════════════════════════════════════${RESET}"
  exit 1
fi
