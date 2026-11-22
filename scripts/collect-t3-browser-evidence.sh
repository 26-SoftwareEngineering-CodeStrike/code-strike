#!/usr/bin/env bash
# Collects the T3 browser evidence: the real H5 account flow against the
# running backend, and the prototype regressions against the mock build.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EVIDENCE="$ROOT/docs/evidence/assignment5-alpha/t3-auth-profile"
SHOTS="$EVIDENCE/screenshots"
BRANCH="$(git -C "$ROOT" rev-parse --abbrev-ref HEAD)"
SHA="$(git -C "$ROOT" rev-parse HEAD)"
PORT=4173
DEBUG_PORT=9222
EDGE="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"

mkdir -p "$SHOTS"
cd "$ROOT"

PROFILE_DIR="/tmp/codestrike-edge-profile-$$"
rm -rf "$PROFILE_DIR"

node scripts/serve-static.mjs apps/student-app/dist/build/h5 "$PORT" > /tmp/codestrike-static.log 2>&1 &
STATIC_PID=$!
"$EDGE" --headless=new --disable-gpu --remote-debugging-port=$DEBUG_PORT \
  --user-data-dir="$PROFILE_DIR" about:blank > /tmp/codestrike-edge.log 2>&1 &
EDGE_PID=$!

cleanup() {
  kill "$EDGE_PID" 2>/dev/null
  kill "$STATIC_PID" 2>/dev/null
  rm -rf "$PROFILE_DIR"
}
trap cleanup EXIT

resolve_ws() {
  # A fresh page target per check: an existing one can already be detached.
  curl -s -X PUT "http://127.0.0.1:$DEBUG_PORT/json/new?url=about:blank" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{console.log(JSON.parse(d).webSocketDebuggerUrl)}catch{console.log('')}})"
}

for _ in $(seq 1 30); do
  WS=$(resolve_ws)
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

run_build() {
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

# The account flow runs against the API mode build.
echo "building the API mode H5 bundle..."
run_build "build-student-h5-api-mode.txt" "Student app H5 production build in API mode" \
  bash -c "cd apps/student-app && VITE_USE_MOCK=false VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1 pnpm build:h5"

run_check "env-switch-in-bundle.txt" "The environment switch is compiled into the production bundle" \
  bash -c "grep -o 'VITE_USE_MOCK:\"[a-z]*\"' apps/student-app/dist/build/h5/assets/index-*.js | head -1 && grep -o 'VITE_API_BASE_URL:\"[^\"]*\"' apps/student-app/dist/build/h5/assets/index-*.js | head -1"

WS=$(resolve_ws)
run_check "h5-account-flow.txt" "Real H5 registration, profile editing, session restore and sign-out at 390 px" \
  node scripts/verify-t3-h5-auth.mjs "$WS" "http://127.0.0.1:$PORT" "$SHOTS"

# The prototype regressions run against the mock build.
echo "building the mock mode H5 bundle..."
run_build "build-student-h5-mock-browser.txt" "Student app H5 production build in mock mode for the prototype regressions" \
  bash -c "cd apps/student-app && pnpm build:h5"

WS=$(resolve_ws)
run_check "h5-regression-wave4.txt" "Assignment 4 prototype regression, Wave 4 assertions" \
  node scripts/verify-h5-wave4.mjs "$WS" "http://127.0.0.1:$PORT" "$SHOTS"

WS=$(resolve_ws)
run_check "h5-regression-design-d1.txt" "Assignment 4 prototype regression, D1 design assertions" \
  node scripts/verify-h5-design-d1.mjs "$WS" "http://127.0.0.1:$PORT" "$SHOTS"

WS=$(resolve_ws)
run_check "html-regression-wave4.txt" "Standalone Assignment 4 HTML prototype regression" \
  node scripts/verify-html-wave4.mjs "$WS" "prototype/html/wave4-pilot"
