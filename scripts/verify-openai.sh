#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env.local"

if [[ ! -f "$ENV_FILE" ]]; then
  echo ".env.local not found"
  exit 1
fi

KEY="$(sed -n 's/^OPENAI_API_KEY=//p' "$ENV_FILE" | head -n1 | sed 's/^[[:space:]"\047]*//; s/[[:space:]"\047]*$//')"

if [[ -z "$KEY" ]]; then
  echo "OPENAI_API_KEY is missing"
  exit 1
fi

STATUS=$(curl -sS -o /tmp/jarvis-openai-check.json -w "%{http_code}" \
  https://api.openai.com/v1/models \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json")

if [[ "$STATUS" == "200" ]]; then
  echo "OPENAI_API_KEY is valid"
  exit 0
fi

echo "OPENAI_API_KEY check failed (HTTP $STATUS)"
if command -v jq >/dev/null 2>&1; then
  jq -r '.error.message // .message // "Unknown error"' /tmp/jarvis-openai-check.json 2>/dev/null || true
else
  cat /tmp/jarvis-openai-check.json
fi
exit 1
