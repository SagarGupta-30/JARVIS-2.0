#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env.local"

if [[ ! -f "$ENV_FILE" ]]; then
  echo ".env.local not found"
  exit 1
fi

KEY="$(sed -n 's/^OPENAI_API_KEY=//p' "$ENV_FILE" | head -n1 | sed 's/^[[:space:]"\047]*//; s/[[:space:]"\047]*$//')"
MODEL="$(sed -n 's/^OPENAI_MODEL=//p' "$ENV_FILE" | head -n1)"
MODEL="${MODEL:-gpt-4o-mini}"

if [[ -z "$KEY" ]]; then
  echo "OPENAI_API_KEY is missing"
  exit 1
fi

RESP=$(curl -sS https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"'"$MODEL"'","messages":[{"role":"user","content":"ping"}],"max_tokens":8}')

if echo "$RESP" | grep -q '"error"'; then
  echo "Chat test failed"
  if command -v jq >/dev/null 2>&1; then
    echo "$RESP" | jq -r '.error.message // "Unknown error"'
  else
    echo "$RESP"
  fi
  exit 1
fi

echo "Chat test succeeded"
