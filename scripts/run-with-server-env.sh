#!/usr/bin/env bash
# Runs a command with the backend environment loaded from the git ignored
# apps/server/.env, so credentials never appear in a command line or in the
# evidence files.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/apps/server/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "apps/server/.env is missing. Copy apps/server/.env.example and fill it in." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

cd "$ROOT/apps/server"
exec "$@"
