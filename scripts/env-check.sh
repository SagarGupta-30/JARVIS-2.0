#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env.local"

if [[ ! -f "$ENV_FILE" ]]; then
  echo ".env.local not found"
  echo "Run: npm run setup:env"
  exit 1
fi

OPENAI_VAL="$(sed -n 's/^OPENAI_API_KEY=//p' "$ENV_FILE" | head -n1)"
MONGO_VAL="$(sed -n 's/^MONGODB_URI=//p' "$ENV_FILE" | head -n1)"
MODEL_VAL="$(sed -n 's/^OPENAI_MODEL=//p' "$ENV_FILE" | head -n1)"

echo "OPENAI_API_KEY: $([[ -n "$OPENAI_VAL" ]] && echo SET || echo MISSING)"
echo "MONGODB_URI: $([[ -n "$MONGO_VAL" ]] && echo SET || echo MISSING)"
echo "OPENAI_MODEL: ${MODEL_VAL:-MISSING}"
