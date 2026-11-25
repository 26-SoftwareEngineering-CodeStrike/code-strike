# T8 — Testing & QA Automation Evidence

This directory records the consolidated full-stack QA verification, MySQL 8.4 concurrency and
integrity testing, live end-to-end API/browser runs, responsive/prototype regressions, manual
regression checklist, defect status, and publication-ready Testing Essay for **Issue #8 (T8 —
Testing & QA Automation, Priority P0)**.

Every log file in `logs/` is the verbatim output of a command executed locally against the
integrated T1–T7 codebase on branch `feat/8-testing-qa`. Nothing is fabricated, extrapolated, or
substituted with SQLite results where MySQL 8.4 is claimed.

| Field | Value |
| --- | --- |
| Issue | [#8](https://github.com/26-SoftwareEngineering-CodeStrike/code-strike/issues/8) — T8 [P0] Testing & QA Automation |
| Branch | `feat/8-testing-qa` (branched from local `feat/7-notifications-planner` `e594852`, which integrates T1–T7) |
| Execution Window | 2026-11-24 to 2026-11-25 (UTC+8) |
| Backend Runtime | FastAPI 0.162.0 / SQLAlchemy 2.0.55 / Alembic 1.20.1 / Python 3.13.9 / pytest 9.1.1 |
| Database | Real MySQL Community Server 8.4.7 (`127.0.0.1:33084`, `READ-COMMITTED`, InnoDB, `utf8mb4`) |
| Frontend Toolchain | Node v24.14.1 / pnpm 11.24.0 / uni-app compiler 5.26 (Vue 3) / Vite 8.3.5 |
| Browser Automation | Google Chrome 156.0.8078.82 (headless, Chrome DevTools Protocol) |
| Open P0 / P1 Defects | **0 P0, 0 P1** |

---

## 1. Automated Verification Expansion Added in T8

To close remaining integration and concurrency test gaps across T5, T6, and T7, T8 added three
new automated suites:

1. **`apps/server/tests/test_t8_mysql_qa.py` (7 real MySQL 8.4 concurrency & integrity tests)**:
   - `test_mysql_concurrent_moderation_same_post_revision`: Concurrent `Approve` vs. `Reject` by two administrators on the same pending post revision; asserts row locking serializes them cleanly (1 win, 1 `409 STALE_REVISION`, exactly 1 `ModerationRecord`, exactly 1 recipient `Notification`).
   - `test_mysql_concurrent_post_edit_vs_admin_approve`: Author edit (`PATCH /posts/{id}`) racing administrator approval (`POST /moderation/{revisionId}`); asserts strict invariant consistency across both valid serializations.
   - `test_mysql_concurrent_post_removal_vs_comment_approve_deadlock_free`: Concurrent parent post `Remove` vs. child comment `Approve`; proves deadlock-free parent-first lock ordering, `pending_count == 0`, and `404` public visibility.
   - `test_mysql_concurrent_post_interactions_idempotent_and_accurate`: 4 concurrent duplicate `Like` calls from one user (no composite-PK error) plus 5 distinct users concurrently toggling `Like` and `Favorite` (exact counts `likes == 6`, `favorites == 5`).
   - `test_mysql_concurrent_course_edit_collision_rolls_back`: Two planner course occurrences concurrently moved onto the same `(week, weekday, period)` slot; asserts 1 win, 1 `409 PLANNER_DUPLICATE_COURSE`, and full rollback of the losing mutation.
   - `test_mysql_notification_concurrent_read_and_privacy_isolation`: Concurrent recipient read updates plus a concurrent non-recipient attempt (`404 NOT_FOUND`), asserting `unreadCount == 0` and recipient privacy.
   - `test_mysql_schema_engine_charset_and_check_constraints`: Verifies InnoDB + `utf8mb4` across all 14 core tables and proves MySQL 8.4 `CHECK` constraints (`ck_planner_times`, `ck_post_interaction_kind`) reject invalid raw writes at storage level.
2. **`apps/student-app/tests/e2e/community-e2e.test.mjs` (2 live T5 API E2E tests)**:
   - Drives `createStudentApiClient` community APIs against FastAPI + MySQL 8.4.7: private draft isolation, protected binary PNG upload & pre-approval privacy (`404` for strangers/guests), comment & nested reply moderation, `403` ownership protection, Like/Favorite reload persistence, edit-revision isolation, and student competition submission create/revise/approve/withdraw lifecycle.
3. **`apps/admin-web/tests/e2e/admin-e2e.test.mjs` (2 live T6 API E2E tests, `pnpm --filter @codestrike/admin-web test:e2e`)**:
   - Drives `createAdminApiClient` against FastAPI + MySQL 8.4.7: student login rejection + immediate token revocation, admin login & `/auth/me` session restore, live `/dashboard` metrics, `/admin/competitions` search/create/patch/delete, unified moderation queues (`Content`, `Competition`, `Recruitment`), authenticated binary PNG preview (`getPostImage`), `Approve`/`Reject`/`Remove` decisions, and logout revocation (`401`).

---

## 2. Full Verification Matrix (17 Recorded Runs)

| # | Category | Suite / Command | Observed Result | Raw Log |
| --- | --- | --- | --- | --- |
| 1 | Static Analysis | `pnpm type-check` (`contracts`, `student-app`, `admin-web`) | **PASS** (0 TS/Vue errors) | `logs/01-type-check.txt` |
| 2 | Frontend Unit & Mock | `pnpm test` (`student-app` + `admin-web`) | **PASS** — **114 passed** (92 student + 22 admin), 0 failed, 0 skipped | `logs/02-frontend-unit-tests.txt` |
| 3 | Backend MySQL 8.4 | `TEST_MYSQL_URL=... pytest -v -rs -rP` | **PASS** — **75 passed**, 0 failed, 0 skipped (75 isolated MySQL 8.4.7 DBs) | `logs/03-pytest-mysql84.txt` |
| 4 | OpenAPI Contracts | `node scripts/verify-t2-openapi-contracts.mjs` | **PASS** — **19/19 DTOs** matched (59 paths / 79 ops / 48 schemas) | `logs/04-openapi-contracts.txt` |
| 5 | Student Live API E2E | `pnpm --filter @codestrike/student-app test:e2e` (4 suites) | **PASS** — **49 passed**, 0 failed, 0 skipped (T3: 14, T4: 30, T5: 2, T7: 3) | `logs/05-student-api-e2e.txt` |
| 6 | Admin Live API E2E | `pnpm --filter @codestrike/admin-web test:e2e` | **PASS** — **2 passed**, 0 failed, 0 skipped (T6) | `logs/06-admin-api-e2e.txt` |
| 7 | Live Browser E2E (T5+T6) | `node scripts/verify-t5-t6-browser.mjs` | **PASS** — full student H5 + admin web journey (20 screen captures) | `logs/07-browser-t5-t6-e2e.txt` |
| 8 | Live Browser E2E (T7) | `node scripts/verify-t7-h5-browser.mjs` | **PASS** — 390px notifications & planner journey (8 screen captures) | `logs/08-browser-t7-h5-e2e.txt` |
| 9 | Live Browser E2E (T3) | `node scripts/verify-t3-h5-auth.mjs` | **PASS** — **24/24 assertions** at 390px | `logs/09-browser-t3-h5-auth.txt` |
| 10 | Live Browser E2E (T4) | `node scripts/verify-t4-h5-teams.mjs` | **PASS** — **53/53 assertions**, 97 live API calls at 390px | `logs/10-browser-t4-h5-teams.txt` |
| 11 | Production Builds | `pnpm build` (H5 + `mp-weixin` + `admin-web`) | **PASS** (exit 0) | `logs/11-workspace-build.txt` |
| 12 | MP-Weixin Package Audit | `node scripts/verify-t9-weixin-build.mjs` | **PASS** — **11/11 checks** (21/21 pages, 408.2 KiB / 2048 KiB) | `logs/12-weixin-build-verify.txt` |
| 13 | MP-Weixin Compat Audit | `node scripts/verify-t9-weixin-compatibility.mjs` | **EXECUTED (exit 0)** — 6 explicit `PATCH` call sites documented (boundary) | `logs/13-weixin-compat-audit.txt` |
| 14 | Mock H5 Wave 4 | `node scripts/verify-h5-wave4.mjs` | **PASS** — **52/52 assertions** (320/390/430/680px) | `logs/14-mock-h5-wave4.txt` |
| 15 | Mock H5 Design D1 | `node scripts/verify-h5-design-d1.mjs` | **PASS** — **232/232 assertions** (overflow, alignment, 44px touch targets) | `logs/15-mock-h5-design-d1.txt` |
| 16 | Mock H5 Design D2 | `node scripts/verify-h5-design-d2.mjs` | **PASS** — **253/253 assertions** (all secondary screens, 320–680px) | `logs/16-mock-h5-design-d2.txt` |
| 17 | HTML Prototype Wave 4 | `node scripts/verify-html-wave4.mjs` | **PASS** — **227/227 assertions** (Assignment 4 HTML files intact) | `logs/17-prototype-html-wave4.txt` |

**Totals**: **240 / 240** automated test cases passed (**0 failed, 0 skipped**), plus **871 / 871** automated contract, package, and responsive/browser assertions passed, plus **28** live end-to-end browser screens verified across T5/T6 (20) and T7 (8).

---

## 3. MySQL 8.4.7 20-User Mixed Load Benchmark (`test_load.py`)

Observed verbatim in `logs/03-pytest-mysql84.txt`:

| Metric | Observed Value | Target | Status |
| --- | --- | --- | --- |
| Concurrent Users / Total Operations | 20 users / 80 mixed ops (`read`, `save`, `apply`, `moderate`) | 0 failed | **PASS** (0 failed) |
| Overall P95 Latency | **0.7473 s** | <= 3.00 s | **PASS** |
| Overall Maximum Latency | **0.7824 s** | <= 3.00 s | **PASS** |
| `read` Maximum (`GET /competitions`) | **0.7824 s** | <= 3.00 s | **PASS** |
| `apply` Maximum (`POST /teams/{id}/applications`) | **0.4432 s** | <= 3.00 s | **PASS** |
| `save` Maximum (`POST /planner/items`) | **0.1646 s** | <= 3.00 s | **PASS** |
| `moderate` Maximum (`POST /moderation/{revisionId}`) | **0.1291 s** | <= 3.00 s | **PASS** |

*Scope note*: Executed in-process against local Windows MySQL 8.4.7 (`READ-COMMITTED`) via FastAPI TestClient ASGI; excludes WAN latency and client-side rendering.

---

## 4. Manual & End-to-End Regression Checklist (T1–T7)

| ID | Area | Check Item | Result | Evidence |
| --- | --- | --- | --- | --- |
| REG-01 | Auth & Session (T3) | Register, duplicate rejection (`409`), login, wrong password (`401`), reload persistence (`/auth/me`), logout token revocation | **PASS** | `logs/05`, `logs/09` |
| REG-02 | Profile & Skills (T3) | Incomplete profile reports all 8 missing fields; catalog skill selection; unknown skill rejected (`422`); student cannot extend catalog (`403`) | **PASS** | `logs/05`, `logs/09` |
| REG-03 | Competitions & Search (T4) | Published competitions listed and searchable; unpublished competitions hidden publicly | **PASS** | `logs/05`, `logs/10` |
| REG-04 | Recruitment & Admission (T4) | Team creation, recruitment moderation approval, apply, duplicate pending blocked (`409`), captain review sanitized preview, approve -> active member, last-slot race (`TEAM_FULL`) | **PASS** | `logs/03`, `logs/05`, `logs/10` |
| REG-05 | Contact & Role Privacy (T4) | Non-captain/non-member blocked (`403`) from review queue and member contacts; active captain reads active member WeChat; My Teams view never leaks contacts | **PASS** | `logs/03`, `logs/05`, `logs/10` |
| REG-06 | Community Posts & Images (T5) | Unapproved post private to author; PNG magic-byte/structure validation; pre-approval image `404` to strangers; post approval publishes post & image; edit revision keeps original live until approved | **PASS** | `logs/03`, `logs/05`, `logs/07` |
| REG-07 | Comments & Interactions (T5) | Incomplete-profile student can comment; threaded replies (`parentId`); Like/Favorite toggle survives full reload; non-author edit/delete refused (`403`) | **PASS** | `logs/03`, `logs/05`, `logs/07` |
| REG-08 | Competition Submissions (T5) | Student submits proposal (private), revises pending proposal, admin approves into public catalog, student withdraws unapproved proposal | **PASS** | `logs/05`, `logs/06` |
| REG-09 | Admin Auth & Dashboard (T6) | Student login rejected & revoked on Admin Web; Admin login & `/auth/me` restore; live `/dashboard` metrics match actionable queues | **PASS** | `logs/02`, `logs/06`, `logs/07` |
| REG-10 | Admin Catalog & Moderation (T6) | Draft/publish/edit/delete competitions; Content, Competition submission, and Recruitment moderation queues across Pending/Approved/Rejected/Superseded; protected binary PNG preview; post removal clears child pending counts | **PASS** | `logs/03`, `logs/06`, `logs/07` |
| REG-11 | Recipient Notifications (T7) | Admission & moderation events populate UI-20 inbox; unread count and read state persist across reloads; All/Unread filters work; non-recipient gets `404` | **PASS** | `logs/03`, `logs/05`, `logs/08` |
| REG-12 | Personal Planner (T7) | Incomplete-profile student uses Day/Week views; overlapping TimedPlans allowed; repeating Todos & Courses persist across reloads; single-occurrence edit/complete/delete leaves siblings intact; course dedup & edit collision rollback | **PASS** | `logs/03`, `logs/05`, `logs/08` |
| REG-13 | Responsive & Mock Safety | Mock H5 Wave 4, D1, D2 pass across 320/390/430/680px with 0 overflow and >=44px touch targets; Prototype Lab hidden in API mode; Assignment 4 HTML files intact | **PASS** | `logs/14`–`logs/17` |
| REG-14 | WeChat Mini Program Build | `mp-weixin` dist compiles with `wxa551256ce5fab6a7`, `urlCheck=true`, 21/21 pages, 408.2 KiB / 2048 KiB | **PASS** | `logs/11`, `logs/12` |
| REG-15 | WeChat Simulator / Device | Runtime testing of UI rendering and `PATCH` requests in WeChat Developer Tools / physical device | **NOT VERIFIED** | Boundary (T9 manual check; DevTools not installed) |
| REG-16 | SMTP Email / Recovery | Real email binding & password recovery delivery over SMTP | **NOT VERIFIED** | Boundary (no SMTP server configured; verified via mocked mailer in `test_auth_codes.py`) |

---

## 5. Defect Summary (T1–T8)

All defects discovered across the Alpha Sprint have been resolved and covered by automated
regression tests. **Zero P0 and zero P1 defects remain open.**

| ID | Stage | Severity | Summary | Resolution & Regression Guard | Status |
| --- | --- | --- | --- | --- | --- |
| DEF-01 | T3 | P0 | `import.meta.env` read via alias prevented Vite from replacing `VITE_USE_MOCK`, leaving API builds stuck in Mock mode | Switched to literal `import.meta.env` expressions in `packages/api-contracts/src/config.ts` | Closed |
| DEF-02 | T3 | P1 | Any `401` (including failed login) cleared active Bearer token | Scoped token clearing strictly to `auth: 'required'` requests (`http-transport.test.mjs`) | Closed |
| DEF-03 | T4 | P1 | `GET /me/team-history` omitted `teamId`; public recruitment list omitted viewer `match` status | Added `teamId` + team state and optional auth viewer match (`test_teams.py`) | Closed |
| DEF-04 | T5 | P1 | No read endpoint for per-user Like/Favorite state caused button state reset on reload | Added `GET /api/v1/posts/{post_id}/interactions` + OpenAPI & E2E checks | Closed |
| DEF-05 | T6 | P1 | `/dashboard` moderation count included removed/deleted parents and orphaned pending comments | Unified actionable filtering in `moderation/service.py` (`test_admin_queue.py`, `test_t8_mysql_qa.py`) | Closed |
| DEF-06 | T6 | P0 | Missing `admin.ts` barrel export, unimplemented `ModerationView.vue`, and missing layout styles broke `admin-web` build | Exported `admin.ts`, completed `ModerationView.vue` & `style.css` (`pnpm type-check`, `logs/06`, `logs/07`) | Closed |
| DEF-07 | T7 | P2 | `toPlannerOccurrence` time formatting change risked breaking adapter unit contract; default uni-app button vertical alignment appeared slightly high | Preserved raw `HH:MM:SS` in adapter (`api-adapters.test.mjs`), formatted in UI via `formatPlannerTime`, aligned button text with flexbox | Closed |
| DEF-08 | T9/T8 | P2 (Boundary) | `PATCH` used at 6 explicit student client call sites is outside WeChat's documented `wx.request` union | Documented honestly in `logs/13-weixin-compat-audit.txt` for manual WeChat Developer Tools verification under T9 | Documented Boundary |

---

## 6. Deliverables in This Directory

- `CodeStrike_Alpha_Sprint_Testing_Essay.md` — Ready-to-import CSDN Testing Essay in formal English.
- `t8-qa-metrics-chart.png` — Two-panel automated test & MySQL 8.4.7 20-user load chart generated from raw logs.
- `logs/01-type-check.txt` through `logs/17-prototype-html-wave4.txt` — Verbatim execution outputs for all 17 verification suites.

## 7. Secret Hygiene

No real credentials, production secrets, AppSecrets, or personal student data appear in this
directory. All E2E runs used isolated temporary databases dropped at teardown and throwaway test
accounts; password fields in browser logs are redacted.
