#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# get-tip-block.sh — Print the current block number for an Avalanche RPC
#
# Usage:
#   ./scripts/get-tip-block.sh https://api.avax.network/ext/bc/C/rpc
#   ./scripts/get-tip-block.sh https://api.avax-test.network/ext/bc/C/rpc
#
# Useful for picking a startBlock in dev configs. Subtract 1000 for ~30 min
# of history, or subtract 100 for a quick dev startup.
# ---------------------------------------------------------------------------
set -euo pipefail

RPC_URL="${1:?Usage: $0 <rpc-url>}"

HEX=$(curl -s -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  "$RPC_URL" | jq -r '.result')

if [ -z "$HEX" ] || [ "$HEX" = "null" ]; then
  echo "Error: could not get block number from $RPC_URL" >&2
  exit 1
fi

DECIMAL=$(printf "%d" "$HEX")
echo "$DECIMAL"
