#!/usr/bin/env bash
set -euo pipefail

# Produce a context-packed summary of the repo for AI assistants.
echo "# warplane — AI context pack"
echo ""
echo "## Repo layout"
find apps packages harness docs scripts -type f \
  ! -path '*/node_modules/*' ! -path '*/dist/*' ! -path '*/.vitepress/cache/*' \
  | sort
echo ""
echo "## Package purposes"
for pkg in packages/*/package.json apps/*/package.json; do
  name=$(grep '"name"' "$pkg" | head -1 | sed 's/.*: *"\(.*\)".*/\1/')
  desc=$(grep '"description"' "$pkg" | head -1 | sed 's/.*: *"\(.*\)".*/\1/')
  echo "- $name: $desc"
done
