#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env.local"
EXAMPLE_FILE="$ROOT_DIR/.env.example"

if [[ -f "$EXAMPLE_FILE" && ! -f "$ENV_FILE" ]]; then
  cp "$EXAMPLE_FILE" "$ENV_FILE"
fi

if [[ -f "$ENV_FILE" ]]; then
  CURRENT_OPENAI="$(sed -n 's/^OPENAI_API_KEY=//p' "$ENV_FILE" | head -n1)"
  CURRENT_MONGO="$(sed -n 's/^MONGODB_URI=//p' "$ENV_FILE" | head -n1)"
  CURRENT_MODEL="$(sed -n 's/^OPENAI_MODEL=//p' "$ENV_FILE" | head -n1)"
else
  CURRENT_OPENAI=""
  CURRENT_MONGO=""
  CURRENT_MODEL="gpt-4o-mini"
fi

printf '\nJARVIS env setup\n'
printf 'Project: %s\n\n' "$ROOT_DIR"

if [[ -z "$CURRENT_OPENAI" ]]; then
  read -r -s -p "Enter OPENAI_API_KEY: " OPENAI_API_KEY_INPUT
  printf '\n'
else
  OPENAI_API_KEY_INPUT="$CURRENT_OPENAI"
  printf 'OPENAI_API_KEY already present. Keeping existing value.\n'
fi

if [[ -z "$CURRENT_MONGO" ]]; then
  read -r -p "Enter MONGODB_URI (or press Enter to skip for now): " MONGODB_URI_INPUT
else
  MONGODB_URI_INPUT="$CURRENT_MONGO"
  printf 'MONGODB_URI already present. Keeping existing value.\n'
fi

read -r -p "OpenAI model [${CURRENT_MODEL:-gpt-4o-mini}]: " OPENAI_MODEL_INPUT
OPENAI_MODEL_INPUT="${OPENAI_MODEL_INPUT:-${CURRENT_MODEL:-gpt-4o-mini}}"

cat > "$ENV_FILE" <<ENVEOF
OPENAI_API_KEY=${OPENAI_API_KEY_INPUT}
OPENAI_MODEL=${OPENAI_MODEL_INPUT}
MONGODB_URI=${MONGODB_URI_INPUT}
ENABLE_SEMANTIC_MEMORY=true
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
ENVEOF

printf '\nSaved %s\n' "$ENV_FILE"

if [[ -z "$OPENAI_API_KEY_INPUT" ]]; then
  printf 'OPENAI_API_KEY: MISSING\n'
else
  printf 'OPENAI_API_KEY: SET\n'
fi

if [[ -z "$MONGODB_URI_INPUT" ]]; then
  printf 'MONGODB_URI: MISSING (memory persistence disabled until set)\n'
else
  printf 'MONGODB_URI: SET\n'
fi

printf '\nNext steps:\n'
printf '  1) npm run dev\n'
printf '  2) Open http://localhost:3000\n\n'
