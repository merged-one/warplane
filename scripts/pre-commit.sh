#!/usr/bin/env bash
set -euo pipefail

# ── Lightweight pre-commit check ─────────────────────────────────────
# Runs fast checks only: lint staged files, typecheck, format check.
# Full test suite is left to CI / manual `pnpm run repo:check`.

echo "pre-commit: typecheck…"
pnpm typecheck

echo "pre-commit: lint…"
pnpm lint

echo "pre-commit: format check…"
pnpm format:check

echo "pre-commit: ok ✓"
