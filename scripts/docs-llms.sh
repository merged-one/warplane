#!/usr/bin/env bash
set -euo pipefail

# Concatenate all markdown docs into a single file for LLM consumption.
echo "# Warplane Documentation Bundle"
echo ""
find docs -name '*.md' -type f | sort | while read -r f; do
  echo "## File: $f"
  echo ""
  cat "$f"
  echo ""
  echo "---"
  echo ""
done
