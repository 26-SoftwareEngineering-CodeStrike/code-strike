#!/usr/bin/env bash
# Collects the T2 evidence files. Every file records the command, the branch,
# the commit SHA, the execution time, the raw output and the real exit code.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EVIDENCE="$ROOT/docs/evidence/assignment5-alpha/t2-shared-http"
BRANCH="$(git -C "$ROOT" rev-parse --abbrev-ref HEAD)"
SHA="$(git -C "$ROOT" rev-parse HEAD)"

mkdir -p "$EVIDENCE"

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
  return $status
}

cd "$ROOT"

run_check "type-check.txt" "TypeScript type check across contracts, student app and admin web" \
  pnpm type-check

run_check "student-mock-and-http-tests.txt" "Student app mock regression and T2 transport, adapter and switch tests" \
  pnpm --filter @codestrike/student-app test:mock

run_check "admin-http-tests.txt" "Admin web HTTP transport, dashboard adapter and Element Plus feedback tests" \
  pnpm --filter @codestrike/admin-web test

run_check "build-student-h5.txt" "Student app H5 production build" \
  pnpm build:student:h5

run_check "build-student-mp-weixin.txt" "Student app mp-weixin production build" \
  pnpm build:student:mp-weixin

run_check "build-admin-web.txt" "Admin web production build" \
  pnpm build:admin

run_check "openapi-contract-comparison.txt" "Shared DTO against the served OpenAPI schema" \
  node scripts/verify-t2-openapi-contracts.mjs

run_check "live-api-check.txt" "Live FastAPI health check and error mapping through the real transport" \
  node --experimental-strip-types --experimental-loader ./scripts/ts-extension-loader.mjs scripts/verify-t2-live-api.mjs
