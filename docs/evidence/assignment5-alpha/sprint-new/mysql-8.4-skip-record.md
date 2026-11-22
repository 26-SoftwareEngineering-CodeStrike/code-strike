# MySQL 8.4 unavailability — recorded skip reasons

The backend's MySQL-specific behaviour was **not** verified in this round. Seven tests were
skipped. They were not run and did not pass. No SQLite result is offered as MySQL evidence.

## What happened

`apps/server/tests/conftest.py` reads `TEST_MYSQL_URL`. When it is unset, the suite runs against
an isolated in-memory SQLite database. When it is set, the fixture connects, asserts the server
version starts with `8.4.`, creates a uniquely named throwaway database
(`codestrike_it_<uuid>`), runs Alembic migrations against it, and drops it afterwards.

`TEST_MYSQL_URL` was not set in this round, so the SQLite path was used and the MySQL-gated
tests skipped themselves.

## Exact skips

Captured verbatim from `backend-pytest.txt`:

```
SKIPPED [1] tests\test_load.py:15: Benchmark requires TEST_MYSQL_URL; SQLite is not performance evidence.
SKIPPED [1] tests\test_mysql_integrity.py:40: Requires TEST_MYSQL_URL to a real MySQL 8.4 instance.
SKIPPED [1] tests\test_mysql_integrity.py:66: Requires TEST_MYSQL_URL to a real MySQL 8.4 instance.
SKIPPED [1] tests\test_mysql_integrity.py:80: Requires TEST_MYSQL_URL to a real MySQL 8.4 instance.
SKIPPED [1] tests\test_mysql_integrity.py:95: Requires TEST_MYSQL_URL to a real MySQL 8.4 instance.
SKIPPED [1] tests\test_mysql_integrity.py:116: Requires TEST_MYSQL_URL to a real MySQL 8.4 instance.
SKIPPED [1] tests\test_planner.py:178: Row-lock concurrency requires MySQL; SQLite is not proof.
```

Summary: `57 passed, 7 skipped`.

## Why MySQL 8.4 was unavailable here

- `apps/server/compose.yaml` provisions MySQL via Docker, but **Docker is not installed** on
  this machine (`docker: command not found`), so the compose stack could not be started.
- The MySQL server installed on this machine is **MySQL 8.0.37**, not 8.4, and the `MySQL80`
  service was **not running** (nothing listening on 3306, 3307 or 33084 at the time of the run).
- Even if that service had been started, `conftest.py` asserts
  `version.startswith("8.4.")` and `test_mysql_integrity.py` asserts the same, so an 8.0.37
  server would have been rejected rather than silently accepted.

Starting or installing a database server was outside the scope of this round, and no
destructive database operation was performed.

## What this means for the imported ADR

`docs/architecture/adr/0002-mysql-conditional-uniqueness-todo.md` was updated by the backend
author to "accepted after actual MySQL 8.4.7 validation (2026-11-08)". That validation was
performed in the backend author's own environment and is **not reproducible in this workspace**.
The five skipped `test_mysql_integrity.py` tests are precisely the ones that would check the
ADR's claims — generated nullable unique guards, last-slot approval races, cross-team approval
rejection, duplicate submissions, concurrent team creation, and withdrawal versus approval.

Until a MySQL 8.4 instance is available and those five tests pass, the ADR's MySQL-specific
claims remain **unverified in this environment**. T1 does not assert them.

## How to close this gap

Provide a reachable MySQL 8.4 instance and re-run:

```
TEST_MYSQL_URL="mysql+pymysql://<user>:<password>@<host>:3306/<database>?charset=utf8mb4" \
  ./.test-venv/Scripts/python.exe -m pytest apps/server/tests/test_mysql_integrity.py -v
```

The fixture creates and drops its own uniquely named database. Do not point `TEST_MYSQL_URL` at
a database holding real data.
