#!/usr/bin/env bash
# Collects the T3 evidence. Every file records the command, the branch, the
# commit SHA, the execution time, the raw output and the real exit code.
#
# The account flow needs the API-mode H5 build, the prototype regressions
# need the mock build, so both are produced here.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EVIDENCE="$ROOT/docs/evidence/assignment5-alpha/t3-auth-profile"
SHOTS="$EVIDENCE/screenshots"
BRANCH="$(git -C "$ROOT" rev-parse --abbrev-ref HEAD)"
SHA="$(git -C "$ROOT" rev-parse HEAD)"

mkdir -p "$EVIDENCE" "$SHOTS"
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

run_check "type-check.txt" "TypeScript type check across contracts, student app and admin web" \
  pnpm type-check

run_check "student-mock-tests.txt" "Student app mock regression and the T2 transport, adapter and switch tests" \
  pnpm --filter @codestrike/student-app test:mock

run_check "admin-http-tests.txt" "Admin web HTTP transport and dashboard adapter tests" \
  pnpm --filter @codestrike/admin-web test

run_check "student-auth-e2e-tests.txt" "T3 end-to-end account and profile tests against the real backend and MySQL" \
  pnpm --filter @codestrike/student-app test:e2e

run_check "backend-pytest-mysql.txt" "Backend test suite against MySQL 8.4, no skipped test" \
  bash scripts/run-with-server-env.sh "$ROOT/apps/server/.venv/Scripts/python.exe" -m pytest -rs

run_check "database-state.txt" "Account, profile and skill rows read back out of MySQL, plus the expired token path" \
  bash -c "CODESTRIKE_TEST_USERNAME=\$(cat '$ROOT/.tools/t3-test-account.txt') bash scripts/run-with-server-env.sh '$ROOT/apps/server/.venv/Scripts/python.exe' ../../scripts/verify-t3-database-state.py"

run_check "build-student-h5-mock.txt" "Student app H5 production build in mock mode" \
  pnpm build:student:h5

run_check "build-student-mp-weixin.txt" "Student app mp-weixin production build" \
  pnpm build:student:mp-weixin

run_check "build-admin-web.txt" "Admin web production build" \
  pnpm build:admin
