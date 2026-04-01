#!/usr/bin/env bash
set -euo pipefail

# Generate llms.txt, llms-full.txt, and context-map.json from docs.
node scripts/generate-llms.mjs
