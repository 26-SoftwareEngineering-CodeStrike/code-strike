# T3 — Auth & Profile Integration

Every file in this directory is the raw output of a command executed on 2026-11-22 against
the T3 branch `feat/3-auth-profile` at commit `5900b11359a606c2039cafe773f0917f4b8f9427`.
Nothing is transcribed by hand and no result is asserted that was not observed.

| Field | Value |
| --- | --- |
| Issue | [#3](https://github.com/26-SoftwareEngineering-CodeStrike/code-strike/issues/3) — T3 [P0] Auth & Profile Integration |
| Branch | `feat/3-auth-profile` |
| Base | `sprint/alpha` at `f36660f` (the merge of PR #10, T2) |
| Implementation commit | `5900b11359a606c2039cafe773f0917f4b8f9427` |
| Backend | FastAPI 0.162.0 on `http://127.0.0.1:8000/api/v1`, connected to MySQL 8.4.6 |
| Database | MySQL 8.4.6, isolated instance on port 3307, database `codestrike` |
| Executed | 2026-11-22 (UTC timestamps are inside each file) |

## Results

| # | Check | Command | Result | Evidence |
| --- | --- | --- | --- | --- |
| 1 | Type check | `pnpm type-check` | **PASS** (exit 0) | `type-check.txt` |
| 2 | Student mock regression and T2 tests | `pnpm --filter @codestrike/student-app test:mock` | **PASS** — 66 passed, 0 failed, 0 skipped | `student-mock-tests.txt` |
| 3 | Admin HTTP tests | `pnpm --filter @codestrike/admin-web test` | **PASS** — 8 passed, 0 failed, 0 skipped | `admin-http-tests.txt` |
| 4 | T3 account end-to-end tests | `pnpm --filter @codestrike/student-app test:e2e` | **PASS** — 14 passed, 0 failed, 0 skipped | `student-auth-e2e-tests.txt` |
| 5 | Backend test suite on MySQL 8.4 | `pytest -rs` | **PASS** — 64 passed, 0 skipped (the 7 MySQL tests of T1 now run) | `backend-pytest-mysql.txt` |
| 6 | Database state and expired token | `scripts/verify-t3-database-state.py` | **PASS** — 11 checks, 0 failures | `database-state.txt` |
| 7 | MySQL 8.4 environment | `scripts/collect-t3-mysql-evidence.sh` | **PASS** — 8.4.6 on 3307, 25 tables | `mysql-84-environment.txt` |
| 8 | Alembic migration | `alembic upgrade head` + `alembic check` | **PASS** — revision `0001 (head)`, no new upgrade operations | `alembic-migration.txt` |
| 9 | FastAPI on MySQL | `GET /health`, `/skills`, `/competitions` | **PASS** — 200, the database routes answer | `fastapi-mysql-connection.txt` |
| 10 | H5 build, API mode | `VITE_USE_MOCK=false pnpm build:student:h5` | **PASS** (exit 0) | `build-student-h5-api-mode.txt` |
| 11 | Environment switch in the bundle | `grep` on the production bundle | **PASS** — `VITE_USE_MOCK:"false"` and the API base URL are compiled in | `env-switch-in-bundle.txt` |
| 12 | Real H5 account flow | `node scripts/verify-t3-h5-auth.mjs` | **PASS** — 24 assertions at 390 px | `h5-account-flow.txt` |
| 13 | H5 build, mock mode | `pnpm build:student:h5` | **PASS** (exit 0) | `build-student-h5-mock.txt`, `build-student-h5-mock-browser.txt` |
| 14 | mp-weixin build | `pnpm build:student:mp-weixin` | **PASS** (exit 0) | `build-student-mp-weixin.txt` |
| 15 | Admin build | `pnpm build:admin` | **PASS** (exit 0) | `build-admin-web.txt` |
| 16 | Prototype regression, Wave 4 | `node scripts/verify-h5-wave4.mjs` | **PASS** — 52 assertions | `h5-regression-wave4.txt` |
| 17 | Prototype regression, D1 design | `node scripts/verify-h5-design-d1.mjs` | **PASS** — 232 assertions | `h5-regression-design-d1.txt` |
| 18 | Standalone HTML prototype regression | `node scripts/verify-html-wave4.mjs` | **PASS** — 227 assertions | `html-regression-wave4.txt` |

Checks 1 to 9 were produced by `scripts/collect-t3-evidence.sh` and
`scripts/collect-t3-mysql-evidence.sh`; checks 10 to 18 by
`scripts/collect-t3-browser-evidence.sh`. Each script records the command, the branch, the
SHA, the UTC execution time, the raw output and the real exit code.

## The MySQL 8.4 environment

Docker is not installed on this machine, so MySQL 8.4.6 was installed from the official
Windows archive into `.tools/` (git ignored) and runs as an isolated instance.

| Property | Value |
| --- | --- |
| Binary | MySQL Community Server 8.4.6 for Win64, from `mysql-8.4.6-winx64.zip` |
| Port | 3307, bound to 127.0.0.1 only |
| Data directory | `.tools/mysql84-data` (its own, not the MySQL 8.0 installation) |
| Database | `codestrike`, plus `codestrike_it_*` databases the test fixture creates and drops |
| Accounts | `codestrike` for the application, `root` for the test fixture; both with a generated 28 character password |
| Credentials | `apps/server/.env` and `.tools/`, both git ignored; never printed in this evidence |

The pre-existing MySQL 8.0 installation was not uninstalled, overwritten, started or
connected to. Its service names and data directory are listed in
`mysql-84-environment.txt` for comparison.

`alembic upgrade head` created 25 tables and `alembic check` reports "No new upgrade
operations detected". The backend test suite now runs 64 tests with **no skip**: the seven
MySQL tests that T1 had to skip against MySQL 8.0.37 all pass against MySQL 8.4.6.

## What the account flow proved

`scripts/verify-t3-h5-auth.mjs` drives the production H5 build in headless Edge against the
running backend: it registers a student, edits the profile, picks a skill tag, saves, reloads
the page, signs out, and checks the screen at 390 px after every step. The screenshots in
`screenshots/t3-0*.png` are these real runs.

`student-auth-e2e-tests.txt` drives the same client code from Node against the same backend
and the same database, covering registration, a duplicate account, a correct password, a
wrong password, `/auth/me`, the profile read and write, an incomplete profile, skill tags,
an unknown skill id, the administrator boundary, an unauthorized route, an invalid token and
signing out.

`database-state.txt` then reads the same account straight out of MySQL: the user row, the
profile row, the profile skill rows and the revoked token. It also inserts a token that has
already expired and confirms the API refuses it. The state is proven to live in the
database, not in a client cache.

## Two defects found and fixed

1. **The environment switch never reached the bundle.** The runtime environment was read
   through an alias (`const meta = import.meta; meta.env`), which the bundler does not
   replace, so the production bundle always started in mock mode no matter what
   `VITE_USE_MOCK` said. It is now read through the literal member expression the bundler
   replaces, and `env-switch-in-bundle.txt` checks that the value really is compiled in.
2. **A rejected sign-in attempt ended the current session.** Every 401 dropped the stored
   token, so signing in with a wrong password logged the already signed-in student out.
   The transport now only ends a session when the refused request needed it, which is what
   `auth: 'required'` means.

## The permission boundary

The skill catalog is maintained by administrators. A student may select tags from it and
attach them to their own profile, but may not create new tags: the end-to-end test shows
`POST /skills` answered with `403 FORBIDDEN` for a student. The administrator account used
to seed the catalog is provisioned directly in MySQL, because the SRS reserves it for the
project team and it is not registrable through the public API.

## Screenshots

`screenshots/` holds 30 PNG files: the seven real account flow captures `t3-01-login.png`
to `t3-07-signed-out.png`, and the 23 files the prototype regressions captured from the
production mock build.

## What was NOT verified

- **Email binding and password recovery were not implemented.** They need a working SMTP
  server. The backend issues a session at registration, so email binding is not a condition
  for signing in; the registration screen says so plainly.
- **No SMTP server, no real mail and no verification code were faked.** The email and
  recovery routes of the backend were not exercised.
- **The mp-weixin build was compiled but not opened in WeChat Developer Tools.** The
  `uni.request` bridge is therefore verified by build and by the shared transport tests,
  not on a device.
- **The session was not verified on a physical device**, only in the H5 browser.
- **No administrator screen was built.** The administration console keeps its Assignment 4
  scope; the administrator work is T6.
- **The competition, team and planner flows were not wired to the API.** They remain T4 and
  T7.

## Secrets

No token, password, hash or other credential appears in this directory. The only credential
like values are the generated throwaway passwords of the accounts the tests create, and
they are not printed.
