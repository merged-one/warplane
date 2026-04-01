#!/usr/bin/env bash
set -euo pipefail

echo "=== Warplane — Milestone 1 Demo ==="
echo ""
echo "1. Building all packages..."
pnpm build
echo ""
echo "2. Running tests..."
pnpm test
echo ""
echo "3. Go harness smoke test..."
cd harness/tmpnet && go test ./...
cd - > /dev/null
echo ""
echo "=== Demo complete ==="
