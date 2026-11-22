# Sprint-new — work performed and re-verified in this round

Every file in this directory is the raw output of a command executed on 2026-11-22 against the
integrated `sprint/alpha` tree (`15e3b947433f6fa09c4f69ed4b9009d150bd8d97`).

> This directory records the **T1** round. The **T2** round (shared contracts and the HTTP
> transport for both clients) recorded its own evidence in the sibling directory
> `../t2-shared-http/`, against commit `c54bcc6`.

## Results

| # | Check | Command | Result | Evidence |
| --- | --- | --- | --- | --- |
| 1 | Type check | `pnpm type-check` | **PASS** (exit 0) | `type-check.txt` |
| 2 | Student Mock tests | `pnpm --filter @codestrike/student-app test:mock` | **PASS** — 35 passed, 0 failed, 0 skipped | `student-mock-tests.txt` |
| 3 | H5 build | `pnpm build:student:h5` | **PASS** (exit 0) | `build-student-h5.txt` |
| 4 | Admin build | `pnpm build:admin` | **PASS** (exit 0) | `build-admin-web.txt` |
| 5 | mp-weixin build | `pnpm build:student:mp-weixin` | **PASS** (exit 0) | `build-student-mp-weixin.txt` |
| 6 | Backend pytest | `pytest` (Python 3.13.9 venv) | **PASS** — 57 passed, 7 skipped | `backend-pytest.txt` |
| 7 | FastAPI health check | `GET /api/v1/health` | **PASS** — HTTP 200, `{"status":"ok","service":"CodeStrike API","api_version":"v1"}` | `fastapi-health-check.txt` |
| 8 | OpenAPI verification | `GET /api/v1/openapi.json` + route assertions | **PASS** — 58 paths, 78 operations, 47 schemas, 0 failures | `openapi-verification.txt`, `openapi.json` |
| 9 | H5 browser regression (Wave 4) | `node scripts/verify-h5-wave4.mjs` | **PASS** — every assertion PASS | `h5-wave4-regression.txt` |
| 10 | H5 browser regression (D1 design) | `node scripts/verify-h5-design-d1.mjs` | **PASS** — every assertion PASS | `h5-design-d1-regression.txt` |
| 11 | Standalone HTML regression | `node scripts/verify-html-wave4.mjs` | **PASS** — every assertion PASS | `html-wave4-regression.txt` |

Check 11 re-runs the Assignment 4 prototype's own verification script against the three
interactive prototype pages. It confirms those files were restored intact after they were
found deleted in the working tree.

## How each check was run

**Type check, builds, Mock tests** — run from the repository root with the workspace's pinned
pnpm 11.24.0 and Node v22.23.2. `pnpm type-check` chains `@codestrike/contracts`,
`@codestrike/student-app` and `@codestrike/admin-web`; all three exited 0.

**Backend pytest** — run from `apps/server/` with `./.test-venv/Scripts/python.exe -m pytest -rs`.
The venv was created with Anaconda's Python 3.13.9 to satisfy `requires-python = ">=3.13,<3.14"`.
Dependencies come from the committed `apps/server/requirements.txt`.

**FastAPI health check** — `uvicorn app.main:app --host 127.0.0.1 --port 8000` with
`DATABASE_URL` unset (the health route does not touch the database), then `GET /api/v1/health`.
`GET /api/v1/docs` also returned 200.

**OpenAPI verification** — the served `openapi.json` was saved verbatim to `openapi.json`, then
asserted: all 11 expected module route groups are present (system/health, auth, profiles,
skills, teams, notifications, planner, competitions, content, moderation, dashboard) and every
operation declares a `responses` object. Result: `RESULT: PASS (0 failures)`.

**H5 browser regressions** — the production H5 build was served on `http://127.0.0.1:4173` and
driven through the Chrome DevTools Protocol by headless Microsoft Edge 157.0.4341.60. The
scripts assert overflow, alignment-line, navigation, touch-target, tab and interaction
behaviour, and write screenshots to `h5-regression/`.

**Standalone HTML regression** — the three Assignment 4 prototype pages were opened over
`file://` in the same headless Edge and driven through the full UI-04 → UI-05 → UI-09 flow at
320, 390, 402×820 and 430 px.

## Screenshots

`h5-regression/` holds 23 PNG files captured in this round:

- `ui04-after-390.png`, `ui05-after-390.png`, `ui09-after-390.png`, `ui11-after-390.png`,
  `ui16-after-390.png` — post-interaction state at 390 px.
- `ui16-day-{320,390,430,680}.png`, `ui16-week-390.png` — Planner Day/Week.
- `ui17-course-entry-{320,390,430,680}.png` — manual finite-course entry.
- `ui18-timed-plan-390.png`, `ui18-todo-{320,390,430,680}.png` — Timed Plan and To-do entry.
- `ui19-occurrence-actions-{320,390,430,680}.png` — single-occurrence actions.

These are real local renders from a production H5 build inspected through Edge device metrics.
They do **not** establish WeChat Developer Tools or physical-device compatibility, and they are
not evidence of MoDao import or native editability.

## What was NOT verified

- MySQL 8.4 behaviour. Seven tests were skipped. See `mysql-8.4-skip-record.md`.
- The mp-weixin build was compiled successfully and its 94 output files exist, but it was not
  opened in WeChat Developer Tools.
- No database was created, migrated or dropped in this round.
