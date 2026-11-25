# CodeStrike Alpha Sprint Testing Essay — Full-Stack QA Automation, MySQL 8.4 Concurrency Verification & Regression Report (T8)

## Basic Information

| Item | Information |
| --- | --- |
| Course | EE308FZ Software Engineering |
| Assignment | Assignment 5 — Alpha Sprint (Testing Essay) |
| Team | CodeStrike (Group 5) |
| Project | Campus Competition & Activity Community (竞伴校园) |
| Sprint Period | November 21–28, 2026 |
| Testing Task | T8 — Testing & QA Automation (Priority P0, Issue #8) |
| Verification Scope | Full integrated codebase covering T1–T7 (`apps/server`, `apps/student-app`, `apps/admin-web`, `packages/api-contracts`) |
| GitHub Repository | [CodeStrike Repository](https://github.com/26-SoftwareEngineering-CodeStrike/code-strike) |
| Integration Target | `sprint/alpha` (verified on local QA branch `feat/8-testing-qa` built atop T1–T7) |
| Open P0 / P1 Defects | **0 P0, 0 P1** |

## Table of Contents

1. [Testing Overview and Quality Objectives](#1-testing-overview-and-quality-objectives)
2. [Test Environment and Toolchain](#2-test-environment-and-toolchain)
3. [Multi-Layer Automated Testing Architecture and T8 Expansion](#3-multi-layer-automated-testing-architecture-and-t8-expansion)
4. [Automated Verification Matrix and Metrics](#4-automated-verification-matrix-and-metrics)
5. [MySQL 8.4 Concurrency, Integrity, and 20-User Load Benchmark](#5-mysql-84-concurrency-integrity-and-20-user-load-benchmark)
6. [End-to-End and Manual Regression Checklist](#6-end-to-end-and-manual-regression-checklist)
7. [Visual Verification Evidence (Screenshot Placeholders)](#7-visual-verification-evidence-screenshot-placeholders)
8. [Defect Tracking and Resolution Log (T1–T8)](#8-defect-tracking-and-resolution-log-t1t8)
9. [Platform Compatibility, Verification Boundaries, and Risks](#9-platform-compatibility-verification-boundaries-and-risks)
10. [Quality Assessment and Release Readiness Conclusion](#10-quality-assessment-and-release-readiness-conclusion)

---

## 1. Testing Overview and Quality Objectives

According to the Alpha Sprint Task Plan published on November 21, 2026, **T8 — Testing & QA Automation (P0)** serves as the consolidated quality gate before release wrap-up (T9). Its acceptance criteria require the team to:

1. Expand automated API and UI verification across all integrated modules (T1–T7);
2. Run real **MySQL 8.4** concurrency, lock-ordering, and relational integrity tests (never substituting SQLite results as MySQL proof);
3. Execute a comprehensive manual and end-to-end regression checklist across both `apps/student-app` and `apps/admin-web`, while ensuring Mock-mode and Assignment 4 prototype assets remain unharmed;
4. Document complete test metrics, concurrency/load benchmarks, defect resolutions, and honest verification boundaries with **zero open P0/P1 defects**.

Across the Alpha Sprint, CodeStrike evolved from a disconnected prototype and backend into a complete two-sided platform spanning authentication and skill-catalog profiles (T3), competition discovery, team recruitment, and capacity/privacy-enforced captain admission (T4), moderated community discussions with protected PNG attachments, comments, likes/favorites, and student competition submissions (T5), an administrator web console with live dashboard metrics and three moderation queues (T6), and recipient notifications (UI-20) alongside a personal course/plan/to-do planner (T7).

T8 validates all seven functional domains together in a unified, repeatable verification run, archived verbatim under `docs/evidence/assignment5-alpha/t8-testing-qa/logs/`.

---

## 2. Test Environment and Toolchain

All T8 tests ran on a local Windows 11 workstation against an isolated **MySQL Community Server 8.4.7** instance running on loopback port `33084`. Every backend test fixture dynamically provisions a fresh `codestrike_it_*` database, executes `alembic upgrade head` under `READ-COMMITTED` transaction isolation, runs its assertions, and drops the database at teardown so zero cross-test state leaks can occur.

| Component | Verified Version / Configuration |
| --- | --- |
| Operating System | Windows 11 (x64) |
| Database Server | MySQL Community Server **8.4.7** (`127.0.0.1:33084`, `InnoDB`, `utf8mb4_0900_ai_ci`, `READ-COMMITTED`) |
| Backend Runtime | Python **3.13.9**, FastAPI **0.162.0**, SQLAlchemy **2.0.55**, Alembic **1.20.1**, pytest **9.1.1** |
| Workspace & Frontend | Node.js **v24.14.1**, pnpm **11.24.0**, uni-app compiler **5.26 (Vue 3)**, Vite **8.3.5**, Element Plus **2.14.7** |
| Browser Automation | Google Chrome **156.0.8078.82** (headless Chrome DevTools Protocol, 320 / 390 / 430 / 680 px mobile viewports + desktop admin viewport) |
| Test Isolation | Per-test random `codestrike_it_*` MySQL databases for pytest; isolated `codestrike_t8_live` database with fresh Alembic migration and seeded skill catalog for live API & browser E2E runs (dropped on teardown) |

---

## 3. Multi-Layer Automated Testing Architecture and T8 Expansion

CodeStrike's QA architecture spans six complementary testing layers so defects are caught as close to their root cause as possible:

1. **Static Type & Build Gate (`pnpm type-check`, `pnpm build`)**: Enforces zero TypeScript/Vue compilation errors across `@codestrike/contracts`, `@codestrike/student-app`, and `@codestrike/admin-web`, and validates clean production bundles for H5, `mp-weixin`, and Admin Web.
2. **Contract Verification (`scripts/verify-t2-openapi-contracts.mjs`)**: Compares 19 shared frontend DTO contracts in `packages/api-contracts` directly against the live FastAPI OpenAPI 3.1.0 schema (`/api/v1/openapi.json` — 59 paths, 79 operations, 48 schemas).
3. **Frontend Unit & Mock State Tests (`pnpm test`)**: Validates HTTP transport error mapping, token management, DTO adapters, Mock business-state invariants, community payload builders, notification routing helpers, planner pagination/formatting, and admin moderation action guards (114 tests total).
4. **Backend API, Security & MySQL 8.4 Concurrency Tests (`pytest` with `TEST_MYSQL_URL`)**: Runs all 75 backend tests directly against MySQL 8.4.7, including relational constraints, concurrent row-locking races, and the 20-user mixed workload benchmark.
5. **Live Full-Stack Node API E2E Suites (`test:e2e`)**: Drives the real TypeScript student and admin API clients against a running Uvicorn/FastAPI + MySQL 8.4.7 server without browser overhead (51 tests total across T3, T4, T5, T6, and T7).
6. **Live Browser CDP E2E & Responsive/Prototype Regressions**: Automates real Chrome instances against both production API-mode builds (T3, T4, T5+T6, T7) and Mock-mode / Assignment 4 HTML builds (Wave 4, D1, D2, HTML Wave 4) across 320–680 px viewports.

### New Automated Suites Added in T8

During T8, we identified three coverage gaps—concurrency races on T5–T7 write paths, live Node API E2E coverage for T5 community workflows, and live Node API E2E coverage for T6 administration workflows—and added three new suites to close them permanently:

| New Suite File | Layer | Cases | Verified Scope |
| --- | --- | ---: | --- |
| `apps/server/tests/test_t8_mysql_qa.py` | Backend MySQL 8.4 Concurrency & Schema Integrity | **7** | Concurrent post moderation (`Approve` vs. `Reject`), author post edit racing admin approval, parent post `Remove` racing comment `Approve` (deadlock-free lock order), concurrent `Like`/`Favorite` composite-PK idempotency and multi-user counts, concurrent planner course edit collision rollback, concurrent notification read + recipient privacy isolation, and InnoDB/`utf8mb4`/`CHECK` constraint enforcement |
| `apps/student-app/tests/e2e/community-e2e.test.mjs` | Student Live API E2E (T5) | **2** | Full community post lifecycle (private draft, protected binary PNG upload & pre-approval `404` privacy, approval publication, threaded replies, `403` ownership protection, Like/Favorite reload persistence, edit-revision isolation, deletion) and student competition submissions (create, revise, admin publish, withdraw) |
| `apps/admin-web/tests/e2e/admin-e2e.test.mjs` | Admin Web Live API E2E (T6) | **2** | Student login rejection + immediate server token revocation, admin sign-in & `/auth/me` restore, live `/dashboard` metrics, `/admin/competitions` draft/search/publish/delete CRUD, unified `Content` / `Competition` / `Recruitment` moderation queues, protected binary PNG preview (`getPostImage`), and logout revocation |

---

## 4. Automated Verification Matrix and Metrics

All 17 verification runs below were executed sequentially against the integrated T1–T7 codebase on `feat/8-testing-qa`. **Zero tests failed and zero tests were skipped.**

| # | Verification Suite | Command / Script | Result | Count / Key Metric | Log Reference |
| --- | --- | --- | --- | --- | --- |
| 1 | Workspace Type Check | `pnpm type-check` | **PASS** | 0 errors (`contracts`, `student-app`, `admin-web`) | `logs/01-type-check.txt` |
| 2 | Student Unit & Mock Tests | `pnpm --filter @codestrike/student-app test:mock` | **PASS** | **92 / 92 passed** (0 failed, 0 skipped) | `logs/02-frontend-unit-tests.txt` |
| 3 | Admin Web Unit Tests | `pnpm --filter @codestrike/admin-web test` | **PASS** | **22 / 22 passed** (0 failed, 0 skipped) | `logs/02-frontend-unit-tests.txt` |
| 4 | Backend Suite on MySQL 8.4.7 | `TEST_MYSQL_URL=... pytest -v -rs -rP` | **PASS** | **75 / 75 passed** (0 failed, 0 skipped) | `logs/03-pytest-mysql84.txt` |
| 5 | OpenAPI 3.1.0 Contract Audit | `node scripts/verify-t2-openapi-contracts.mjs` | **PASS** | **19 / 19 DTOs** (59 paths / 79 ops / 48 schemas) | `logs/04-openapi-contracts.txt` |
| 6 | Student Live API E2E (4 suites) | `pnpm --filter @codestrike/student-app test:e2e` | **PASS** | **49 / 49 passed** (T3: 14, T4: 30, T5: 2, T7: 3) | `logs/05-student-api-e2e.txt` |
| 7 | Admin Web Live API E2E (T6) | `pnpm --filter @codestrike/admin-web test:e2e` | **PASS** | **2 / 2 passed** (0 failed, 0 skipped) | `logs/06-admin-api-e2e.txt` |
| 8 | Live Browser E2E — T5 & T6 | `node scripts/verify-t5-t6-browser.mjs` | **PASS** | Full student H5 + admin web flow (20 screens) | `logs/07-browser-t5-t6-e2e.txt` |
| 9 | Live Browser E2E — T7 | `node scripts/verify-t7-h5-browser.mjs` | **PASS** | 390 px notifications + planner flow (8 screens) | `logs/08-browser-t7-h5-e2e.txt` |
| 10 | Live Browser E2E — T3 | `node scripts/verify-t3-h5-auth.mjs` | **PASS** | **24 / 24 assertions** at 390 px | `logs/09-browser-t3-h5-auth.txt` |
| 11 | Live Browser E2E — T4 | `node scripts/verify-t4-h5-teams.mjs` | **PASS** | **53 / 53 assertions**, 97 real API calls | `logs/10-browser-t4-h5-teams.txt` |
| 12 | Full Production Builds | `pnpm build` (`h5` + `mp-weixin` + `admin-web`) | **PASS** | Exit 0 across all 3 targets | `logs/11-workspace-build.txt` |
| 13 | MP-Weixin Package Audit | `node scripts/verify-t9-weixin-build.mjs` | **PASS** | **11 / 11 checks** (21/21 pages, 408.2 / 2048 KiB) | `logs/12-weixin-build-verify.txt` |
| 14 | MP-Weixin HTTP Compat Audit | `node scripts/verify-t9-weixin-compatibility.mjs` | **AUDIT** | Exit 0; 6 explicit `PATCH` call sites logged | `logs/13-weixin-compat-audit.txt` |
| 15 | Mock H5 Wave 4 Regression | `node scripts/verify-h5-wave4.mjs` | **PASS** | **52 / 52 assertions** (320 / 390 / 430 / 680 px) | `logs/14-mock-h5-wave4.txt` |
| 16 | Mock H5 Design D1 Audit | `node scripts/verify-h5-design-d1.mjs` | **PASS** | **232 / 232 assertions** (alignment, nav, >=44 px) | `logs/15-mock-h5-design-d1.txt` |
| 17 | Mock H5 Design D2 Audit | `node scripts/verify-h5-design-d2.mjs` | **PASS** | **253 / 253 assertions** (secondary flows, 320–680 px) | `logs/16-mock-h5-design-d2.txt` |
| 18 | HTML Prototype Wave 4 | `node scripts/verify-html-wave4.mjs` | **PASS** | **227 / 227 assertions** (Assignment 4 files intact) | `logs/17-prototype-html-wave4.txt` |

**Aggregate Automated Verification Summary:**

- **Automated Test Cases (`pytest` + Node test runner):** **240 / 240 passed** (75 backend MySQL + 92 student unit/mock + 22 admin unit + 49 student live API E2E + 2 admin live API E2E), **0 failed, 0 skipped**.
- **Automated Contract, Package & Browser Assertions:** **871 / 871 explicit `PASS` assertions** (`19 + 24 + 53 + 11 + 52 + 232 + 253 + 227`) plus **28 end-to-end live screen verifications** (`verify-t5-t6-browser.mjs` [20] and `verify-t7-h5-browser.mjs` [8]).

> **[Chart Placeholder — Automated QA Metrics & MySQL 8.4.7 Latency Summary]**
> Insert local chart file: `docs/evidence/assignment5-alpha/t8-testing-qa/t8-qa-metrics-chart.png`
> *Caption: Figure 1 — Left: Automated test suite pass breakdown (240/240 passed, 0 failed, 0 skipped). Right: Observed latency maxima and P95 under the 20-user mixed workload benchmark against MySQL 8.4.7 vs. the 3.00 s target threshold.*

---

## 5. MySQL 8.4 Concurrency, Integrity, and 20-User Load Benchmark

### 5.1 Database-Level Concurrency and Relational Invariant Coverage

A core risk in campus recruitment and moderation platforms is subtle race conditions under concurrent requests (e.g., admitting two students into the last remaining team slot, double-processing a moderation revision, or deadlocking when a post is removed while its child comment is moderated).

Because SQLite serializes writes globally and cannot emulate InnoDB row locks or MySQL stored generated columns, all 75 backend tests were executed directly against **MySQL 8.4.7 (`READ-COMMITTED`)**. Thirteen dedicated MySQL-only concurrency and constraint tests explicitly assert `SELECT VERSION()` begins with `8.4.` and `SELECT @@transaction_isolation = 'READ-COMMITTED'`:

| Test Module | Test Case | Concurrency / Integrity Invariant Verified | Result |
| --- | --- | --- | --- |
| `test_mysql_integrity.py` | `test_generated_nullable_unique_guards` | Stored generated columns enforce unique active/pending records while allowing repeated terminal historical rows | **PASS** |
| `test_mysql_integrity.py` | `test_concurrent_last_places` | 4 simultaneous approvals racing for 2 remaining team slots admit strictly 2 members; remaining 2 fail with `TEAM_FULL` and are invalidated | **PASS** |
| `test_mysql_integrity.py` | `test_concurrent_two_teams_same_applicant` | Two captains concurrently approving the same applicant in one competition produce strictly 1 active membership and invalidate the other application | **PASS** |
| `test_mysql_integrity.py` | `test_concurrent_create_and_duplicate_apply` | Duplicate simultaneous applications yield 1 row; simultaneous team creations by the same student yield 1 team and invalidate pending applications | **PASS** |
| `test_mysql_integrity.py` | `test_withdraw_approve_race` | Applicant withdrawal racing captain approval resolves cleanly to either `(Approved, active member)` or `(Withdrawn, no membership)` | **PASS** |
| `test_planner.py` | `test_mysql_concurrent_course_dedup` | Concurrent identical multi-week course submissions serialize via owner row lock and `course_key` SHA-256 unique index (3 created, 3 skipped, 0 duplicates) | **PASS** |
| `test_t8_mysql_qa.py` | `test_mysql_concurrent_moderation_same_post_revision` | Two admins racing `Approve` vs. `Reject` on one post revision yield strictly 1 decision, 1 `409 STALE_REVISION`, 1 `ModerationRecord`, and 1 author notification | **PASS** |
| `test_t8_mysql_qa.py` | `test_mysql_concurrent_post_edit_vs_admin_approve` | Author edit racing admin approval preserves valid `Post`/`PostRevision`/`ModerationRecord` state under both serializations | **PASS** |
| `test_t8_mysql_qa.py` | `test_mysql_concurrent_post_removal_vs_comment_approve_deadlock_free` | Parent-first row lock ordering eliminates InnoDB deadlocks when post `Remove` races comment `Approve`; `pending_count` drops to `0` | **PASS** |
| `test_t8_mysql_qa.py` | `test_mysql_concurrent_post_interactions_idempotent_and_accurate` | 4 concurrent same-user `Like` calls stay idempotent without PK errors; 5 distinct users toggling `Like` + `Favorite` yield exact counts (`likes=6, favorites=5`) | **PASS** |
| `test_t8_mysql_qa.py` | `test_mysql_concurrent_course_edit_collision_rolls_back` | Two courses concurrently moved onto the same slot yield 1 success and 1 `409 PLANNER_DUPLICATE_COURSE` with clean rollback | **PASS** |
| `test_t8_mysql_qa.py` | `test_mysql_notification_concurrent_read_and_privacy_isolation` | Concurrent recipient read marks converge cleanly to `unreadCount=0`; concurrent non-recipient request returns `404 NOT_FOUND` | **PASS** |
| `test_t8_mysql_qa.py` | `test_mysql_schema_engine_charset_and_check_constraints` | Confirms `InnoDB` + `utf8mb4` across all 14 core tables and verifies MySQL `CHECK` constraints reject invalid planner times and interaction kinds | **PASS** |

### 5.2 Twenty-User Mixed Workload Benchmark (`test_load.py`)

`apps/server/tests/test_load.py` synchronizes 20 concurrent threads behind a `threading.Barrier(20)` so every simulated student simultaneously executes a 4-operation mixed workload (`GET /competitions`, `POST /planner/items`, `POST /teams/{id}/applications`, and admin `POST /moderation/{revisionId}`) against MySQL 8.4.7 — **80 concurrent transactional API operations** in total.

Verbatim `LOAD_EVIDENCE` output recorded in `docs/evidence/assignment5-alpha/t8-testing-qa/logs/03-pytest-mysql84.txt`:

| Benchmark Metric | Observed Result | Acceptance Target | Outcome |
| --- | ---: | ---: | --- |
| Concurrent Users | 20 | 20 | **PASS** |
| Total Mixed Operations | 80 | 80 | **PASS** |
| Failed Operations | **0** | 0 | **PASS** |
| Overall P95 Latency | **0.7473 s** | <= 3.00 s | **PASS** |
| Overall Maximum Latency | **0.7824 s** | <= 3.00 s | **PASS** |
| `read` Maximum (`GET /competitions`) | **0.7824 s** | <= 3.00 s | **PASS** |
| `apply` Maximum (`POST /teams/{id}/applications`) | **0.4432 s** | <= 3.00 s | **PASS** |
| `save` Maximum (`POST /planner/items`) | **0.1646 s** | <= 3.00 s | **PASS** |
| `moderate` Maximum (`POST /moderation/{revisionId}`) | **0.1291 s** | <= 3.00 s | **PASS** |

*Benchmark scope disclosure*: This benchmark runs in-process against local Windows MySQL 8.4.7 (`READ-COMMITTED`) through FastAPI's ASGI `TestClient`. It measures database locking, serialization, and API handler overhead accurately, but excludes wide-area network latency and client-side rendering time.

---

## 6. End-to-End and Manual Regression Checklist

The regression checklist below verifies every core user story across T1–T7 after full integration, distinguishing verified checks from explicit non-verified environment boundaries.

| Check ID | Module | Regression Scenario | Expected Behavior | Status | Verification Source |
| --- | --- | --- | --- | --- | --- |
| REG-01 | Auth (T3) | Registration, duplicate username, login, invalid password, reload `/auth/me`, logout | Token stored via `uni.setStorageSync`, restored on reload, revoked (`401`) on logout; duplicates `409` | **PASS** | `logs/05`, `logs/09` |
| REG-02 | Profile & Skills (T3) | Profile completeness gate, admin skill catalog, non-admin catalog write | Fresh profile lists 8 missing fields; unknown skill `422`; student `POST /skills` `403` | **PASS** | `logs/05`, `logs/09` |
| REG-03 | Competitions (T4) | Public catalog listing, keyword search, unpublished visibility | Only published competitions appear in `/competitions`; search filters accurately | **PASS** | `logs/05`, `logs/10` |
| REG-04 | Recruitment & Teams (T4) | Create team, submit recruitment revision, admin approve, apply, captain admit | Unpublished recruitment hidden until approved; duplicate apply `409`; full team blocks excess approvals (`TEAM_FULL`) | **PASS** | `logs/03`, `logs/05`, `logs/10` |
| REG-05 | Privacy & RBAC (T4) | Captain queue preview vs. private contacts; URL team ID tampering | Non-captain/non-member blocked (`403`); captain queue shows only 5 preview fields; WeChat exposed only to active captain for active members | **PASS** | `logs/03`, `logs/05`, `logs/10` |
| REG-06 | Community Posts (T5) | Post with PNG image, pre-approval visibility, edit revision isolation, delete | Pending post & PNG private (`404` to strangers); public after approval; pending edit preserves live approved version | **PASS** | `logs/03`, `logs/05`, `logs/07` |
| REG-07 | Comments & Interactions (T5) | Incomplete-profile comment, nested reply, Like/Favorite reload persistence, ownership | Comments work with incomplete profile; likes/favorites persist across full reload; non-author mutation `403` | **PASS** | `logs/03`, `logs/05`, `logs/07` |
| REG-08 | Competition Submissions (T5) | Student submits proposal, revises pending draft, admin approves, student withdraws | Private before approval; published into `/competitions` after admin approval; withdrawn records marked `deleted=true` and removed from pending queue | **PASS** | `logs/05`, `logs/06` |
| REG-09 | Admin Auth & Dashboard (T6) | Student blocked on Admin Web; Admin login, `/auth/me` restore, live `/dashboard` | Student login token revoked immediately; dashboard counts reflect live actionable items | **PASS** | `logs/02`, `logs/06`, `logs/07` |
| REG-10 | Admin Moderation (T6) | Content, Competition submission, and Recruitment queues + protected image preview | Status filters (`Pending`/`Approved`/`Rejected`/`Superseded`), Proposed vs. Effective diff, authenticated PNG preview, `Approve`/`Reject`/`Remove` with required reason | **PASS** | `logs/03`, `logs/06`, `logs/07` |
| REG-11 | Notifications (T7) | Admission & moderation notifications in UI-20, mark read, reload, privacy | Unread badge/count updates and survives reload; All/Unread filters work; stranger access returns `404` | **PASS** | `logs/03`, `logs/05`, `logs/08` |
| REG-12 | Personal Planner (T7) | Day/Week views for incomplete-profile student, Course/TimedPlan/Todo CRUD, dedup | Overlapping TimedPlans allowed; single-occurrence edit/complete/delete leaves siblings intact; course dedup skips duplicates | **PASS** | `logs/03`, `logs/05`, `logs/08` |
| REG-13 | Responsive & Mock Safety | Mock H5 Wave 4, Design D1 & D2 across 320 / 390 / 430 / 680 px + HTML prototype | Zero horizontal overflow, consistent gutters, >=44 px touch targets, Prototype Lab hidden in API mode, Assignment 4 HTML intact | **PASS** | `logs/14`–`logs/17` |
| REG-14 | MP-Weixin Build | Compile `mp-weixin` package and verify manifest/pages/bundle budget | `wxa551256ce5fab6a7`, `urlCheck=true`, 21/21 pages complete, 408.2 KiB / 2048 KiB | **PASS** | `logs/11`, `logs/12` |
| REG-15 | WeChat DevTools Runtime | Simulator & physical-device runtime rendering + `PATCH` network behavior | Requires WeChat Developer Tools (not installed on test host) | **NOT VERIFIED** | Tracked under T9 (`logs/13`) |
| REG-16 | Live SMTP Email | Real SMTP delivery for email binding and password recovery codes | No external SMTP server provisioned; verified via mocked mailer in `test_auth_codes.py` | **NOT VERIFIED** | Backend unit coverage (`logs/03`) |

---

## 7. Visual Verification Evidence (Screenshot Placeholders)

Representative live screenshots captured during automated mobile (390 px H5) and desktop (Admin Web) verification across the integrated modules can be inserted directly below when publishing on CSDN:

### 7.1 Student Account, Profile & Team Admission Flows (T3 & T4 — 390 px Mobile H5)

> **[Screenshot Placeholder 1 — Account Profile Persistence (T3)]**
> Insert local file: `docs/evidence/assignment5-alpha/t3-auth-profile/screenshots/t3-06-profile-after-reload.png`
> *Caption: Verified student profile completeness and catalog skill tags persisted in MySQL across full browser reload at 390 px.*

> **[Screenshot Placeholder 2 — Captain Review & Admission Flow (T4)]**
> Insert local file: `docs/evidence/assignment5-alpha/t4-competitions-teams/screenshots/A5_T4_06_Captain_Review.png`
> *Caption: Captain pending application queue showing sanitized 5-field applicant preview and skill-overlap match badge without leaking private contact details.*

### 7.2 Community Discussions & Admin Moderation Console (T5 & T6)

> **[Screenshot Placeholder 3 — Approved Community Post with Protected PNG & Persistent Interactions (T5)]**
> Insert local file: `docs/evidence/assignment5-alpha/sprint-new/stage-3/browser-evidence/t5-t6-2026-11-24T10-22-03-590Z-a4bb058c/09a-h5-interactions-on-reloaded.png`
> *Caption: Approved competition post showing authenticated PNG image preview and persisted Like/Favorite counts after full page reload.*

> **[Screenshot Placeholder 4 — Admin Web Revision Comparison & Moderation Dialog (T6)]**
> Insert local file: `docs/evidence/assignment5-alpha/sprint-new/stage-3/browser-evidence/t5-t6-2026-11-24T10-22-03-590Z-a4bb058c/12-admin-edit-review.png`
> *Caption: Administration console displaying side-by-side Proposed revision vs. Currently effective content with revision history and policy-bound Approve/Reject/Remove controls.*

### 7.3 Recipient Notifications & Personal Planner (T7 — 390 px Mobile H5)

> **[Screenshot Placeholder 5 — Recipient Notification Inbox (UI-20, 390 px)]**
> Insert local file: `docs/evidence/assignment5-alpha/t7-notifications-planner/screenshots/t7-01-notifications-inbox.png`
> *Caption: UI-20 Notification inbox displaying real admission (`ApplicationApproved`, `MemberJoined`) and moderation (`ModerationApprove`) events with live unread badge.*

> **[Screenshot Placeholder 6 — Personal Planner Day View Persisted Across Reload (UI-16, 390 px)]**
> Insert local file: `docs/evidence/assignment5-alpha/t7-notifications-planner/screenshots/t7-04-planner-reloaded.png`
> *Caption: Integrated personal planner showing persisted Timed Plan and completed To-do occurrences after full reload in API mode.*

---

## 8. Defect Tracking and Resolution Log (T1–T8)

Every defect identified during integration and QA testing across the Alpha Sprint has been logged, fixed, and covered by an automated regression test. **At T8 completion, there are 0 open P0 defects and 0 open P1 defects.**

| Defect ID | Found In | Severity | Description | Root Cause & Fix | Regression Test | Status |
| --- | --- | --- | --- | --- | --- | --- |
| DEF-01 | T3 | **P0** | Production H5 API build remained stuck in Mock mode regardless of `VITE_USE_MOCK=false` | `import.meta.env` was accessed through an alias (`const meta = import.meta`), bypassing Vite's static compile-time replacement; replaced with literal `import.meta.env.*` accesses in `packages/api-contracts/src/config.ts` | Bundle check + live T3/T4/T5/T7 H5 builds | **Closed** |
| DEF-02 | T3 | **P1** | Failed sign-in (`401`) evicted an existing valid student Bearer session | Global `401` handler cleared the token store unconditionally; restricted clearing to requests marked `auth: 'required'` | `apps/student-app/tests/http-transport.test.mjs` | **Closed** |
| DEF-03 | T4 | **P1** | `GET /me/team-history` lacked `teamId`, and public recruitment list omitted viewer skill `match` status | Extended backend projections in `teams/service.py` and added optional-auth viewer matching in `teams/router.py` | `apps/server/tests/test_teams.py` | **Closed** |
| DEF-04 | T5 | **P1** | Reloading a post detail screen lost per-user Like/Favorite active toggle states | Backend initially exposed only aggregate counts; added `GET /api/v1/posts/{post_id}/interactions` and aligned `PostInteractionsDto` | `verify-t2-openapi-contracts.mjs`, `community-e2e.test.mjs`, `verify-t5-t6-browser.mjs` | **Closed** |
| DEF-05 | T6 | **P1** | `/dashboard` `moderationCount` included orphaned pending comments and pending edits under removed posts | Unified actionable revision query filtering in `moderation/service.py` so deleted/removed/superseded rows and comments under removed posts are excluded consistently | `test_admin_queue.py`, `test_t8_mysql_qa.py` | **Closed** |
| DEF-06 | T6 | **P0** | `admin-web` type-check failed due to missing `admin.ts` barrel export, unimplemented `ModerationView.vue`, and missing utility styles | Exported `admin.ts` in `packages/api-contracts/src/api/index.ts`, implemented full `ModerationView.vue` with all 3 queues and image previews, completed `apps/admin-web/src/style.css` | `pnpm type-check`, `admin-e2e.test.mjs`, `verify-t5-t6-browser.mjs` | **Closed** |
| DEF-07 | T7 | **P2** | Default uni-app block button alignment rendered text slightly above center; planner time formatting needed to preserve raw adapter DTO strings | Kept raw `HH:MM:SS` in `toPlannerOccurrence`, formatted `HH:MM` via `formatPlannerTime` in UI views, and applied flex centering to action buttons | `api-adapters.test.mjs`, `notifications-planner.test.mjs`, `verify-t7-h5-browser.mjs` | **Closed** |
| DEF-08 | T9 / T8 | **P2 (Boundary)** | Six explicit student API call sites use HTTP `PATCH`, which is omitted from WeChat Mini Program's documented `wx.request` method union | Documented statically by `scripts/verify-t9-weixin-compatibility.mjs`; requires manual runtime validation in WeChat Developer Tools under T9 before deciding whether to migrate routes to `PUT`/`POST` | `logs/13-weixin-compat-audit.txt` | **Documented Boundary** |

| Severity | Total Discovered | Closed | Open |
| --- | ---: | ---: | ---: |
| **P0 (Blocker)** | 2 | 2 | **0** |
| **P1 (Critical)** | 4 | 4 | **0** |
| **P2 (Minor / Boundary)** | 2 | 1 | **1 (Platform Compatibility Boundary, T9)** |

---

## 9. Platform Compatibility, Verification Boundaries, and Risks

To uphold strict evidence integrity, the team explicitly records what automated QA has **not** verified in this local Windows environment:

1. **WeChat Mini Program Simulator & Physical Device Runtime (T9)**: `pnpm build:student:mp-weixin` compiles all **21 pages** cleanly at **408.2 KiB / 2048 KiB** (`wxa551256ce5fab6a7`, `urlCheck=true`). However, WeChat Developer Tools is not installed on the local QA host, so mini program visual rendering and runtime execution of the **6 explicit `PATCH` call sites** (`client.ts:1029` profile update, `community.ts:70` post edit, `community.ts:76` comment edit, `notifications.ts:83` read toggle, `planner.ts:232` item edit, `planner.ts:255` todo toggle, plus conditional `PATCH` in `community.ts:93`) remain **Not Verified** until manual testing in WeChat Developer Tools under T9.
2. **External SMTP Email Delivery**: Password recovery and email verification code workflows are verified against MySQL 8.4.7 using an injected `TestMailer` in `apps/server/tests/test_auth_codes.py` (covering single-use consumption, expiration, retry exhaustion, and `503 EMAIL_UNAVAILABLE` fail-closed behavior when SMTP is unconfigured), but no live external SMTP server was connected.
3. **Production Network & Deployment Environment**: The 20-user load benchmark (`max 0.7824 s`, `p95 0.7473 s`) ran locally against MySQL 8.4.7 via ASGI `TestClient` without WAN latency, reverse-proxy TLS termination, or production object storage for uploaded post images.
4. **No Continuous Integration (CI) Pipeline Yet**: This repository does not currently define GitHub Actions workflows; every result in `docs/evidence/assignment5-alpha/t8-testing-qa/logs/` comes from reproducible local execution scripts.

---

## 10. Quality Assessment and Release Readiness Conclusion

T8 achieved all planned Alpha Sprint quality objectives:

- **Full-Stack Regression Confidence**: **240 / 240 automated test cases**, **871 / 871 contract/package/responsive assertions**, and **28 live browser E2E screen checks** passed with **0 failures and 0 skips**.
- **Proven MySQL 8.4 Integrity Under Contention**: All 75 backend tests—including 13 real MySQL 8.4 concurrency, lock-ordering, and schema-constraint tests plus the 20-user / 80-operation mixed load benchmark (`0` failed, `0.7473 s` P95 vs. `3.00 s` target)—passed cleanly on real MySQL 8.4.7 (`READ-COMMITTED`).
- **Zero Open Release Blockers**: Every P0 and P1 defect discovered across T1–T8 has been resolved and locked down with automated regression tests.

With T1–T8 functionally complete and verified, the Alpha Sprint is ready for final T9 wrap-up (WeChat Developer Tools verification, final burn-up update, Sprint Summary Essay, and Topical Collection Essay).

---

**Related Links**

- [CodeStrike GitHub Repository](https://github.com/26-SoftwareEngineering-CodeStrike/code-strike)
- [Alpha Sprint Task Plan (CSDN)](https://bbs.csdn.net/topics/620614150)
- [Alpha Sprint Essay 1 — Day 1–2 (CSDN)](https://bbs.csdn.net/topics/620613081)
- [Alpha Sprint Essay 2 — Day 3–4 (CSDN)](https://bbs.csdn.net/topics/620619500)
- [T8 Issue #8 — Testing & QA Automation](https://github.com/26-SoftwareEngineering-CodeStrike/code-strike/issues/8)
- [T8 Evidence Directory](https://github.com/26-SoftwareEngineering-CodeStrike/code-strike/tree/sprint/alpha/docs/evidence/assignment5-alpha/t8-testing-qa)
