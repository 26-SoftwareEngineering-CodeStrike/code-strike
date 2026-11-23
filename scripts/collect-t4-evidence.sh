#!/usr/bin/env bash
# Collects the T4 evidence: the real MySQL end-to-end runs, the frontend and
# backend regressions, the production builds and the real H5 browser flow.
#
# The backend and the isolated MySQL 8.4 instance have to be running. When a
# check cannot run, the log records that as a failure; nothing is reported as
# passed that did not run.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EVIDENCE="$ROOT/docs/evidence/assignment5-alpha/t4-competitions-teams"
RESULTS="$EVIDENCE/test-results"
LOGS="$EVIDENCE/logs"
SHOTS="$EVIDENCE/screenshots"
BRANCH="$(git -C "$ROOT" rev-parse --abbrev-ref HEAD)"
SHA="$(git -C "$ROOT" rev-parse HEAD)"
API_BASE_URL="${CODE_STRIKE_API_BASE_URL:-http://127.0.0.1:8000/api/v1}"
PORT=4173
DEBUG_PORT=9222
EDGE="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
PYTHON="$ROOT/.test-venv/Scripts/python.exe"

mkdir -p "$RESULTS" "$LOGS" "$SHOTS"
cd "$ROOT"

run_check() {
  local file="$1"
  local description="$2"
  shift 2
  {
    echo "check      : $description"
    echo "command    : $*"
    echo "branch     : $BRANCH"
    echo "sha        : $SHA"
    echo "executed   : $(date -u +'%Y-%m-%dT%H:%M:%SZ')"
    echo "--- output ---"
  } > "$file"
  "$@" >> "$file" 2>&1
  local status=$?
  {
    echo "--- end of output ---"
    echo "exit code  : $status"
    echo "result     : $([ $status -eq 0 ] && echo PASS || echo FAIL)"
  } >> "$file"
  echo "$file -> exit $status"
}

# The backend environment carries the database credentials, so it is loaded
# into the environment instead of being written into a command line.
with_server_env() {
  set -a
  # shellcheck disable=SC1091
  . "$ROOT/apps/server/.env"
  set +a
  "$@"
}

echo "collecting the T4 evidence on $BRANCH at $SHA"

run_check "$LOGS/environment.txt" "The isolated MySQL 8.4 instance and the API" \
  bash -c "cd '$ROOT' && bash scripts/run-with-server-env.sh '$PYTHON' '$ROOT/scripts/verify-t4-environment.py'"

# The backend tests need the database environment, otherwise the MySQL checks
# skip and the suite would run against SQLite instead.
run_check "$RESULTS/backend-pytest.txt" "The whole backend test suite against MySQL 8.4" \
  bash -c "set -a; . '$ROOT/apps/server/.env'; set +a; cd '$ROOT/apps/server' && '$PYTHON' -m pytest -rs"

run_check "$RESULTS/backend-mysql-integrity.txt" "The MySQL integrity tests" \
  bash -c "set -a; . '$ROOT/apps/server/.env'; set +a; cd '$ROOT/apps/server' && '$PYTHON' -m pytest tests/test_mysql_integrity.py -v"

run_check "$RESULTS/student-app-mock.txt" "The student app Mock regression suite" \
  bash -c "cd '$ROOT' && pnpm --filter @codestrike/student-app test:mock"

# The end-to-end suite signs in as the administrator, so the backend
# environment is loaded into it. The credentials never reach a command line.
run_check "$RESULTS/student-app-e2e.txt" "The student app end-to-end suite against MySQL 8.4" \
  bash -c "set -a; . '$ROOT/apps/server/.env'; set +a; cd '$ROOT' && CODE_STRIKE_API_BASE_URL='$API_BASE_URL' pnpm --filter @codestrike/student-app test:e2e"

run_check "$RESULTS/admin-web.txt" "The admin web regression suite" \
  bash -c "cd '$ROOT' && pnpm --filter @codestrike/admin-web test"

run_check "$LOGS/type-check.txt" "The workspace type check" \
  bash -c "cd '$ROOT' && pnpm type-check"

run_check "$LOGS/build-student-h5.txt" "The student app H5 production build in Mock mode" \
  bash -c "cd '$ROOT/apps/student-app' && pnpm build:h5"

run_check "$LOGS/build-student-mp-weixin.txt" "The student app WeChat mini program build" \
  bash -c "cd '$ROOT/apps/student-app' && pnpm build:mp-weixin"

run_check "$LOGS/build-admin.txt" "The admin web production build" \
  bash -c "cd '$ROOT' && pnpm build:admin"

run_check "$LOGS/build-student-h5-api-mode.txt" "The student app H5 production build in API mode" \
  bash -c "cd '$ROOT/apps/student-app' && VITE_USE_MOCK=false VITE_API_BASE_URL=$API_BASE_URL pnpm build:h5"

run_check "$LOGS/openapi-contract.txt" "The shared DTOs against the served OpenAPI document" \
  bash -c "cd '$ROOT' && CODE_STRIKE_API_BASE_URL='$API_BASE_URL' node scripts/verify-t2-openapi-contracts.mjs"

run_check "$LOGS/database-state.txt" "The recruitment, application and membership rows read back from MySQL" \
  bash -c "cd '$ROOT' && bash scripts/run-with-server-env.sh '$PYTHON' '$ROOT/scripts/verify-t4-database-state.py'"

# --- the real H5 browser flow -------------------------------------------------
PROFILE_DIR="/tmp/codestrike-edge-profile-t4-$$"
rm -rf "$PROFILE_DIR"

# A browser left over from an earlier run would keep the debug port and drive
# stale page targets instead of the ones this run creates.
taskkill //IM msedge.exe //F >/dev/null 2>&1 || true
sleep 2

node scripts/serve-static.mjs apps/student-app/dist/build/h5 "$PORT" > /tmp/codestrike-static-t4.log 2>&1 &
STATIC_PID=$!
"$EDGE" --headless=new --disable-gpu --remote-debugging-port=$DEBUG_PORT \
  --user-data-dir="$PROFILE_DIR" about:blank > /tmp/codestrike-edge-t4.log 2>&1 &
EDGE_PID=$!

cleanup() {
  kill "$EDGE_PID" 2>/dev/null
  kill "$STATIC_PID" 2>/dev/null
  rm -rf "$PROFILE_DIR"
}
trap cleanup EXIT

for _ in $(seq 1 30); do
  curl -s -o /dev/null "http://127.0.0.1:$PORT/" && break
  sleep 1
done

if ! curl -s -o /dev/null "http://127.0.0.1:$PORT/"; then
  echo "the static server did not start on port $PORT" >&2
  cat /tmp/codestrike-static-t4.log >&2
  exit 1
fi

for _ in $(seq 1 30); do
  curl -s -o /dev/null "http://127.0.0.1:$DEBUG_PORT/json/version" && break
  sleep 1
done

# Only a page target can be driven; the browser and worker targets are not.
resolve_ws() {
  curl -s -X PUT "http://127.0.0.1:$DEBUG_PORT/json/new?url=about:blank" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{console.log(JSON.parse(d).webSocketDebuggerUrl)}catch{console.log('')}})"
}

close_stale_pages() {
  curl -s "http://127.0.0.1:$DEBUG_PORT/json/list" | node -e "
let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{
  const targets = JSON.parse(d).filter((t) => t.type === 'page' && t.url !== 'about:blank')
  for (const target of targets) console.log(target.id)
})" | while read -r id; do
    [ -n "$id" ] && curl -s -o /dev/null "http://127.0.0.1:$DEBUG_PORT/json/close/$id"
  done
}

WS=$(resolve_ws)
run_check "$LOGS/h5-browser-flow.txt" "The real H5 team flow against the backend and MySQL 8.4" \
  bash -c "cd '$ROOT' && bash scripts/run-with-server-env.sh node '$ROOT/scripts/verify-t4-h5-teams.mjs' '$WS' 'http://127.0.0.1:$PORT' '$SHOTS' '$API_BASE_URL'"

# The prototype regressions run against the Mock build, so the bundle is
# rebuilt in Mock mode before they run.
run_check "$LOGS/build-student-h5-mock-browser.txt" "The student app H5 production build in Mock mode for the prototype regressions" \
  bash -c "cd '$ROOT/apps/student-app' && pnpm build:h5"

mkdir -p /tmp/codestrike-t4-prototype-shots

close_stale_pages
WS=$(resolve_ws)
run_check "$LOGS/prototype-regression-wave4.txt" "The Assignment 4 prototype regression, Wave 4 assertions" \
  bash -c "cd '$ROOT' && node scripts/verify-h5-wave4.mjs '$WS' 'http://127.0.0.1:$PORT' '/tmp/codestrike-t4-prototype-shots'"

close_stale_pages
WS=$(resolve_ws)
run_check "$LOGS/prototype-regression-design-d1.txt" "The Assignment 4 prototype regression, D1 design assertions" \
  bash -c "cd '$ROOT' && node scripts/verify-h5-design-d1.mjs '$WS' 'http://127.0.0.1:$PORT' '/tmp/codestrike-t4-prototype-shots'"

close_stale_pages
WS=$(resolve_ws)
run_check "$LOGS/prototype-regression-html.txt" "The standalone Assignment 4 HTML prototype regression" \
  bash -c "cd '$ROOT' && node scripts/verify-html-wave4.mjs '$WS' 'prototype/html/wave4-pilot'"

echo "the T4 evidence is in $EVIDENCE"
