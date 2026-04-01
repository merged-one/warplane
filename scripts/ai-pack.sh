#!/usr/bin/env bash
set -euo pipefail

# Generate an AI-friendly context bundle of the repo.
# Uses repomix if available, falls back to manual concatenation.
#
# Usage:
#   pnpm ai:pack          # full bundle (source + docs)
#   pnpm ai:pack:docs     # docs-only bundle

MODE="${1:-full}"

if command -v repomix &> /dev/null; then
  if [ "$MODE" = "docs" ]; then
    repomix --config repomix-docs.config.json
  else
    repomix --config repomix.config.json
  fi
else
  # Fallback: manual concatenation
  echo "# warplane — AI context pack ($MODE)"
  echo ""

  if [ "$MODE" = "docs" ]; then
    FILES=$(find docs AGENTS.md README.md CONTRIBUTING.md -name '*.md' -o -name '*.yaml' 2>/dev/null | sort)
  else
    echo "## Repo layout"
    find apps packages harness docs scripts -type f \
      ! -path '*/node_modules/*' ! -path '*/dist/*' ! -path '*/.vitepress/cache/*' \
      ! -path '*/.vitepress/dist/*' \
      | sort
    echo ""

    echo "## Package purposes"
    for pkg in packages/*/package.json apps/*/package.json; do
      name=$(grep '"name"' "$pkg" | head -1 | sed 's/.*: *"\(.*\)".*/\1/')
      desc=$(grep '"description"' "$pkg" | head -1 | sed 's/.*: *"\(.*\)".*/\1/')
      echo "- $name: $desc"
    done
    echo ""

    FILES=$(find packages/*/src apps/api/src apps/web/src docs AGENTS.md README.md CONTRIBUTING.md \
      \( -name '*.ts' -o -name '*.tsx' -o -name '*.md' -o -name '*.yaml' \) 2>/dev/null | sort)
  fi

  for f in $FILES; do
    echo "---"
    echo "## File: $f"
    echo ""
    cat "$f"
    echo ""
  done
fi
