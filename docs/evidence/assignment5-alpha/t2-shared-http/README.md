# T2 — Shared Types & HTTP Client

Every file in this directory is the raw output of a command executed on 2026-11-22 against
the T2 branch `feat/2-shared-http` at commit `c54bcc6244d5b89bf167685ad967144a771cc1f1`.
Nothing is transcribed by hand and no result is asserted that was not observed.

| Field | Value |
| --- | --- |
| Issue | [#2](https://github.com/26-SoftwareEngineering-CodeStrike/code-strike/issues/2) — T2 [P0] Shared Types & HTTP Client |
| Branch | `feat/2-shared-http` |
| Base | `sprint/alpha` at `c7d6806` |
| Implementation commit | `c54bcc6244d5b89bf167685ad967144a771cc1f1` |
| Executed | 2026-11-22 (UTC timestamps are inside each file) |

## Results

| # | Check | Command | Result | Evidence |
| --- | --- | --- | --- | --- |
| 1 | Type check | `pnpm type-check` | **PASS** (exit 0) — contracts, student app and admin web | `type-check.txt` |
| 2 | Student mock regression and T2 tests | `pnpm --filter @codestrike/student-app test:mock` | **PASS** — 63 passed, 0 failed, 0 skipped (35 pre-existing + 28 new) | `student-mock-and-http-tests.txt` |
| 3 | Admin HTTP tests | `pnpm --filter @codestrike/admin-web test` | **PASS** — 8 passed, 0 failed, 0 skipped | `admin-http-tests.txt` |
| 4 | H5 build | `pnpm build:student:h5` | **PASS** (exit 0) | `build-student-h5.txt` |
| 5 | mp-weixin build | `pnpm build:student:mp-weixin` | **PASS** (exit 0) | `build-student-mp-weixin.txt` |
| 6 | Admin build | `pnpm build:admin` | **PASS** (exit 0) | `build-admin-web.txt` |
| 7 | OpenAPI contract comparison | `node scripts/verify-t2-openapi-contracts.mjs` | **PASS** — 12 shared DTOs match the served schema, 0 failures | `openapi-contract-comparison.txt` |
| 8 | Live FastAPI check | `node scripts/verify-t2-live-api.mjs` | **PASS** — 7 of 7 checks against the running backend | `live-api-check.txt` |
| 9 | H5 browser regression, Wave 4 | `node scripts/verify-h5-wave4.mjs` | **PASS** — 52 assertions | `h5-regression-wave4.txt` |
| 10 | H5 browser regression, D1 design | `node scripts/verify-h5-design-d1.mjs` | **PASS** — 232 assertions | `h5-regression-design-d1.txt` |
| 11 | Standalone HTML prototype regression | `node scripts/verify-html-wave4.mjs` | **PASS** — 227 assertions | `html-regression-wave4.txt` |

Checks 1 to 8 were produced by `scripts/collect-t2-evidence.sh`; checks 9 to 11 by
`scripts/collect-t2-browser-evidence.sh`. Both scripts record the command, the branch,
the SHA, the UTC execution time, the raw output and the real exit code.

## What the live check proved

`scripts/verify-t2-live-api.mjs` drives the **real** transport against a running
`uvicorn app.main:app` on `http://127.0.0.1:8000/api/v1`:

- `GET /api/v1/health` answers `{"status":"ok","service":"CodeStrike API","api_version":"v1"}`,
  which is exactly the `HealthResponse` contract.
- A request marked `auth: 'required'` without a token is refused locally and never
  reaches the server.
- `GET /api/v1/dashboard` without a token is answered by the backend as
  `401 {"code":"UNAUTHENTICATED","message":"Sign in is required."}` and is mapped onto
  `ApiError` with status 401.
- `GET /api/v1/competitions` answers `503 {"code":"DATABASE_UNAVAILABLE"}` because no
  database is configured, and is mapped onto `ApiError` with status 503.
- `GET /api/v1/does-not-exist` answers `404 {"code":"HTTP_ERROR"}`; the server's own
  code is preserved.
- The served `openapi.json` still reports 58 paths and 47 schemas, identical to the
  document captured in T1.

## Contract differences

`contract-differences.md` lists every difference found between the prototype view
models and the backend schemas, the adapter that resolves it, and the differences
deliberately left for T3, T4 and T7. No type was loosened with `any` and no prototype
field was removed.

## Screenshots

`h5-regression/` holds the 23 PNG files captured by checks 9 and 10 from the production
H5 build of this commit. They are the same set the T1 round captured, which shows the
Assignment 4 screens are unchanged.

## What was NOT verified

- **No authenticated request was made.** No user was registered and no token was
  obtained, so every authenticated route was exercised only through its 401 path. Real
  user authentication is T3.
- **No competition or team business flow was executed end to end.** The competitions and
  recruitments routes were called only through the transport unit tests; the complete
  flow is T4.
- **No database was configured.** The live check saw `503 DATABASE_UNAVAILABLE` from the
  database backed routes, and MySQL 8.4 remains unverified exactly as T1 recorded it.
- **The mp-weixin build was compiled but not opened in WeChat Developer Tools.** The
  `uni.request` adapter is therefore verified by build and by the shared transport
  tests, not on a device.
- **PATCH on mp-weixin was not exercised.** The uni type union omits PATCH although the
  WeChat network stack accepts it; no PATCH route is called by the T2 scope.

## Secrets

No token, password, key or other credential was written to this directory. The only
values that appear are the literal placeholder strings used by the tests.
