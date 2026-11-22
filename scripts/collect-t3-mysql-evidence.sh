#!/usr/bin/env bash
# Collects the MySQL 8.4 environment evidence for T3.
# No credential is written: the passwords live only in the git ignored
# apps/server/.env and in the shell environment.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EVIDENCE="$ROOT/docs/evidence/assignment5-alpha/t3-auth-profile"
BRANCH="$(git -C "$ROOT" rev-parse --abbrev-ref HEAD)"
SHA="$(git -C "$ROOT" rev-parse HEAD)"
MYSQL_HOME="$ROOT/.tools/mysql-8.4.6-winx64"
MYSQL_CONFIG="$ROOT/.tools/mysql84-config.ini"

mkdir -p "$EVIDENCE"
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

mysql_server_report() {
  echo "--- mysqld binary ---"
  "$MYSQL_HOME/bin/mysqld.exe" --version
  echo "--- listening socket ---"
  netstat -ano | grep LISTENING | grep ":3307" || echo "port 3307 is not listening"
  echo "--- server variables ---"
  bash scripts/run-with-server-env.sh "$MYSQL_HOME/bin/mysql.exe" \
    --defaults-file="$MYSQL_CONFIG" -u codestrike -p"$MYSQL_PASSWORD" -e \
    "SELECT VERSION() AS version, @@port AS port, @@character_set_server AS charset, @@collation_server AS collation, @@datadir AS datadir;"
  echo "--- databases visible to the application user ---"
  bash scripts/run-with-server-env.sh "$MYSQL_HOME/bin/mysql.exe" \
    --defaults-file="$MYSQL_CONFIG" -u codestrike -p"$MYSQL_PASSWORD" -e \
    "SHOW DATABASES;"
  echo "--- tables in the codestrike database ---"
  bash scripts/run-with-server-env.sh "$MYSQL_HOME/bin/mysql.exe" \
    --defaults-file="$MYSQL_CONFIG" -u codestrike -p"$MYSQL_PASSWORD" codestrike -e \
    "SHOW TABLES;"
  echo "--- isolation of the pre-existing MySQL 8.0 installation ---"
  echo "MySQL 8.0 service names found on this machine:"
  sc query state= all 2>&1 | grep -i "SERVICE_NAME: MySQL" || true
  echo "MySQL 8.0 data directory (untouched, not started by this task):"
  ls "/d/Program Files/MySQL/MySQL Data 8.0" 2>&1 | head -5
}

alembic_report() {
  echo "--- alembic upgrade head ---"
  bash scripts/run-with-server-env.sh "$ROOT/apps/server/.venv/Scripts/python.exe" -m alembic upgrade head
  echo "--- alembic current ---"
  bash scripts/run-with-server-env.sh "$ROOT/apps/server/.venv/Scripts/python.exe" -m alembic current
  echo "--- alembic check ---"
  bash scripts/run-with-server-env.sh "$ROOT/apps/server/.venv/Scripts/python.exe" -m alembic check
}

fastapi_report() {
  echo "--- GET /api/v1/health ---"
  curl -s -w "\nstatus=%{http_code}\n" http://127.0.0.1:8000/api/v1/health
  echo "--- GET /api/v1/skills (database backed) ---"
  curl -s -w "\nstatus=%{http_code}\n" http://127.0.0.1:8000/api/v1/skills
  echo "--- GET /api/v1/competitions (database backed) ---"
  curl -s -w "\nstatus=%{http_code}\n" http://127.0.0.1:8000/api/v1/competitions
  echo "--- GET /api/v1/auth/me without a token ---"
  curl -s -w "\nstatus=%{http_code}\n" http://127.0.0.1:8000/api/v1/auth/me
}

set -a
# shellcheck disable=SC1091
. "$ROOT/apps/server/.env"
set +a

run_check "mysql-84-environment.txt" "Isolated MySQL 8.4 instance, isolation facts and schema" mysql_server_report
run_check "alembic-migration.txt" "Alembic upgrade head and alembic check against MySQL 8.4" alembic_report
run_check "fastapi-mysql-connection.txt" "FastAPI reaching MySQL 8.4 through the API" fastapi_report
run_check "backend-pytest-mysql.txt" "Backend test suite against MySQL 8.4, no skips" \
  bash scripts/run-with-server-env.sh "$ROOT/apps/server/.venv/Scripts/python.exe" -m pytest -rs
