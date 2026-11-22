#!/usr/bin/env bash
# Collects the T2 browser regression evidence. It serves the production H5
# build, drives it through headless Edge and records every exit code.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EVIDENCE="$ROOT/docs/evidence/assignment5-alpha/t2-shared-http"
SHOTS="$EVIDENCE/h5-regression"
BRANCH="$(git -C "$ROOT" rev-parse --abbrev-ref HEAD)"
SHA="$(git -C "$ROOT" rev-parse HEAD)"
PORT=4173
DEBUG_PORT=9222
EDGE="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"

mkdir -p "$SHOTS"
cd "$ROOT"

node scripts/serve-static.mjs apps/student-app/dist/build/h5 "$PORT" > /tmp/codestrike-static.log 2>&1 &
STATIC_PID=$!
"$EDGE" --headless=new --disable-gpu --remote-debugging-port=$DEBUG_PORT \
  --user-data-dir=/tmp/codestrike-edge-profile about:blank > /tmp/codestrike-edge.log 2>&1 &
EDGE_PID=$!

cleanup() {
  kill "$EDGE_PID" 2>/dev/null
  kill "$STATIC_PID" 2>/dev/null
}
trap cleanup EXIT

for _ in $(seq 1 30); do
  WS=$(curl -s "http://127.0.0.1:$DEBUG_PORT/json/list" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const t=JSON.parse(d).find(x=>x.type==='page');console.log(t?t.webSocketDebuggerUrl:'')})" 2>/dev/null)
  [ -n "${WS:-}" ] && break
  sleep 1
done

for _ in $(seq 1 30); do
  curl -s -o /dev/null "http://127.0.0.1:$PORT/" && break
  sleep 1
done

if ! curl -s -o /dev/null "http://127.0.0.1:$PORT/"; then
  echo "the static server did not start on port $PORT" >&2
  cat /tmp/codestrike-static.log >&2
  exit 1
fi

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
  } > "$EVIDENCE/$file"
  "$@" >> "$EVIDENCE/$file" 2>&1
  local status=$?
  {
    echo "--- end of output ---"
    echo "exit code  : $status"
    echo "result     : $([ $status -eq 0 ] && echo PASS || echo FAIL)"
  } >> "$EVIDENCE/$file"
  echo "$file -> exit $status"
}

run_check "h5-regression-wave4.txt" "H5 browser regression, Wave 4 assertions" \
  node scripts/verify-h5-wave4.mjs "$WS" "http://127.0.0.1:$PORT" "$SHOTS"

run_check "h5-regression-design-d1.txt" "H5 browser regression, D1 design assertions" \
  node scripts/verify-h5-design-d1.mjs "$WS" "http://127.0.0.1:$PORT" "$SHOTS"

run_check "html-regression-wave4.txt" "Standalone Assignment 4 HTML prototype regression" \
  node scripts/verify-html-wave4.mjs "$WS" "prototype/html/wave4-pilot"
