#!/usr/bin/env bash
# Collects the WeChat mini program readiness evidence.
#
# Every check records the command, the branch, the SHA, the UTC execution
# time, the raw output and the real exit code. When a check cannot run, the
# log records that as a failure; nothing is reported as passed that did not
# run.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EVIDENCE="$ROOT/docs/evidence/assignment5-alpha/t9-weixin-readiness"
RESULTS="$EVIDENCE/logs"
SHOTS="$EVIDENCE/screenshots"
BRANCH="$(git -C "$ROOT" rev-parse --abbrev-ref HEAD)"
SHA="$(git -C "$ROOT" rev-parse HEAD)"
API_BASE_URL="${CODE_STRIKE_API_BASE_URL:-http://127.0.0.1:8000/api/v1}"

mkdir -p "$RESULTS" "$SHOTS"
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

run_check "$RESULTS/type-check.txt" "The workspace type check" \
  bash -c "cd '$ROOT' && pnpm type-check"

run_check "$RESULTS/build-mp-weixin.txt" "The WeChat mini program production build, Mock mode" \
  bash -c "cd '$ROOT' && pnpm build:student:mp-weixin"

run_check "$RESULTS/verify-build-mp-weixin-mock.txt" "The built mini program package, Mock mode" \
  bash -c "cd '$ROOT' && node scripts/verify-t9-weixin-build.mjs"

run_check "$RESULTS/build-mp-weixin-api.txt" "The WeChat mini program production build, API mode" \
  bash -c "cd '$ROOT' && VITE_USE_MOCK=false VITE_API_BASE_URL='https://api.example.invalid/api/v1' pnpm build:student:mp-weixin"

run_check "$RESULTS/verify-build-mp-weixin-api.txt" "The built mini program package, API mode" \
  bash -c "cd '$ROOT' && node scripts/verify-t9-weixin-build.mjs"

run_check "$RESULTS/build-h5-mock.txt" "The H5 production build, Mock mode" \
  bash -c "cd '$ROOT' && pnpm build:student:h5"

run_check "$RESULTS/build-h5-api.txt" "The H5 production build, API mode" \
  bash -c "cd '$ROOT' && VITE_USE_MOCK=false VITE_API_BASE_URL='https://api.example.invalid/api/v1' pnpm build:student:h5"

run_check "$RESULTS/compatibility-audit.txt" "The HTTP methods the client sends against the documented mini program method set" \
  bash -c "cd '$ROOT' && node scripts/verify-t9-weixin-compatibility.mjs"

run_check "$RESULTS/devtools-availability.txt" "Whether the WeChat Developer Tools are installed" \
  bash -c "cd '$ROOT' && node scripts/verify-t9-weixin-devtools.mjs"

run_check "$RESULTS/deployment-readiness.txt" "The deployment posture of the backend" \
  bash -c "cd '$ROOT' && '$ROOT/.test-venv/Scripts/python.exe' '$ROOT/scripts/verify-t9-deployment-readiness.py'"

run_check "$RESULTS/manifest-config.txt" "The mini program configuration that was committed" \
  bash -c "cd '$ROOT' && cat apps/student-app/src/manifest.json"

run_check "$RESULTS/build-result.txt" "The build result that the picture is rendered from" \
  bash -c "cd '$ROOT' && {
    echo 'CodeStrike WeChat mini program build result'
    echo 'branch:' '$BRANCH'
    echo 'sha   :' '$SHA'
    echo 'executed:' \"\$(date -u +'%Y-%m-%dT%H:%M:%SZ')\"
    echo
    echo '--- the workspace type check ---'
    cat '$RESULTS/type-check.txt'
    echo
    echo '--- the mini program build, API mode ---'
    cat '$RESULTS/build-mp-weixin-api.txt'
    echo
    echo '--- the built package, API mode ---'
    cat '$RESULTS/verify-build-mp-weixin-api.txt'
    echo
    echo '--- the HTTP method audit ---'
    cat '$RESULTS/compatibility-audit.txt'
  }"

run_check "$RESULTS/render-build-result.txt" "The build result picture" \
  bash -c "cd '$ROOT' && node scripts/render-evidence-log.mjs '$RESULTS/build-result.txt' '$SHOTS/A5_MP_01_Build_Result.png' 'CodeStrike WeChat mini program build result'"

# --- the screens, captured from the H5 bundle --------------------------------
# The WeChat Developer Tools are not installed on this machine, so the mini
# program cannot be started and its screens cannot be captured. The three
# screens are captured from the H5 production bundle instead, and every one of
# them carries a banner that names the platform it was taken on.
#
# The bundle has to point at the running backend, so it is rebuilt against the
# local API before the browser is started.
run_check "$RESULTS/build-h5-api-local.txt" "The H5 production build against the local API, for the screens" \
  bash -c "cd '$ROOT' && VITE_USE_MOCK=false VITE_API_BASE_URL='$API_BASE_URL' pnpm build:student:h5"

PORT=4173
DEBUG_PORT=9228
EDGE="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
PYTHON="$ROOT/.test-venv/Scripts/python.exe"

taskkill //IM msedge.exe //F >/dev/null 2>&1 || true
sleep 2

PROFILE_DIR="/tmp/codestrike-edge-profile-t9-$$"
rm -rf "$PROFILE_DIR"

node scripts/serve-static.mjs apps/student-app/dist/build/h5 "$PORT" > /tmp/codestrike-static-t9.log 2>&1 &
STATIC_PID=$!
"$EDGE" --headless=new --disable-gpu --remote-debugging-port=$DEBUG_PORT \
  --user-data-dir="$PROFILE_DIR" about:blank > /tmp/codestrike-edge-t9.log 2>&1 &
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
for _ in $(seq 1 30); do
  curl -s -o /dev/null "http://127.0.0.1:$DEBUG_PORT/json/version" && break
  sleep 1
done

WS=$(curl -s -X PUT "http://127.0.0.1:$DEBUG_PORT/json/new?url=about:blank" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{console.log(JSON.parse(d).webSocketDebuggerUrl)}catch{console.log('')}})")

run_check "$RESULTS/screenshots.txt" "The three screens, captured from the H5 bundle against the real backend" \
  bash -c "cd '$ROOT' && bash scripts/run-with-server-env.sh node '$ROOT/scripts/collect-t9-weixin-evidence.mjs' '$WS' 'http://127.0.0.1:$PORT' '$SHOTS' '$API_BASE_URL'"

echo "the T9 evidence is in $EVIDENCE"
