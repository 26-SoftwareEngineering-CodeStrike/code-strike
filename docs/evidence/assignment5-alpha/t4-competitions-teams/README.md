# T4 — Competitions & Teams Integration

Every file in this directory is the raw output of a command executed on 2026-11-23 against
the T4 branch `feat/4-competitions-teams`. Nothing is transcribed by hand and no result is
asserted that was not observed.

| Field | Value |
| --- | --- |
| Issue | [#4](https://github.com/26-SoftwareEngineering-CodeStrike/code-strike/issues/4) — T4 [P0] Competitions & Teams Integration |
| Branch | `feat/4-competitions-teams` |
| Base | `sprint/alpha` at `15059fe` (the merge of PR #11, T3) |
| Backend | FastAPI 0.162.0 on `http://127.0.0.1:8000/api/v1`, connected to MySQL 8.4.6 |
| Database | MySQL 8.4.6, isolated instance on port 3307, database `codestrike` |
| Executed | 2026-11-23 (UTC timestamps are inside each file) |

`contract-differences.md` was written **before** the implementation and lists every real route
and field that was audited against the prototype view models.

## Results

| # | Check | Command | Result | Evidence |
| --- | --- | --- | --- | --- |
| 1 | MySQL 8.4 environment | `scripts/verify-t4-environment.py` | **PASS** — 8.4.6, `codestrike`, migration `0001` | `logs/environment.txt` |
| 2 | Backend test suite on MySQL 8.4 | `pytest -rs` | **PASS** — 66 passed, 0 skipped | `test-results/backend-pytest.txt` |
| 3 | MySQL integrity tests | `pytest tests/test_mysql_integrity.py -v` | **PASS** — 5 passed | `test-results/backend-mysql-integrity.txt` |
| 4 | Student app Mock regression | `pnpm --filter @codestrike/student-app test:mock` | **PASS** — 78 passed, 0 failed, 0 skipped | `test-results/student-app-mock.txt` |
| 5 | Student app end-to-end suite | `pnpm --filter @codestrike/student-app test:e2e` | **PASS** — 44 passed, 0 failed, 0 skipped | `test-results/student-app-e2e.txt` |
| 6 | Admin web regression | `pnpm --filter @codestrike/admin-web test` | **PASS** — 8 passed, 0 failed, 0 skipped | `test-results/admin-web.txt` |
| 7 | Workspace type check | `pnpm type-check` | **PASS** (exit 0) | `logs/type-check.txt` |
| 8 | H5 production build, Mock mode | `pnpm build:h5` | **PASS** (exit 0) | `logs/build-student-h5.txt` |
| 9 | mp-weixin build | `pnpm build:mp-weixin` | **PASS** (exit 0) | `logs/build-student-mp-weixin.txt` |
| 10 | Admin web build | `pnpm build:admin` | **PASS** (exit 0) | `logs/build-admin.txt` |
| 11 | H5 production build, API mode | `VITE_USE_MOCK=false pnpm build:h5` | **PASS** (exit 0) | `logs/build-student-h5-api-mode.txt` |
| 12 | Shared DTOs against the served OpenAPI | `scripts/verify-t2-openapi-contracts.mjs` | **PASS** — 0 failures, 58 paths and 47 schemas unchanged | `logs/openapi-contract.txt` |
| 13 | Recruitment, application and membership rows read back from MySQL | `scripts/verify-t4-database-state.py` | **PASS** — 22 checks, 0 failures | `logs/database-state.txt` |
| 14 | Real H5 team flow | `node scripts/verify-t4-h5-teams.mjs` | **PASS** — 53 assertions, 101 real API calls | `logs/h5-browser-flow.txt` |
| 15 | H5 production build, Mock mode, for the regressions | `pnpm build:h5` | **PASS** (exit 0) | `logs/build-student-h5-mock-browser.txt` |
| 16 | Prototype regression, Wave 4 | `node scripts/verify-h5-wave4.mjs` | **PASS** — 52 assertions | `logs/prototype-regression-wave4.txt` |
| 17 | Prototype regression, D1 design | `node scripts/verify-h5-design-d1.mjs` | **PASS** — 232 assertions | `logs/prototype-regression-design-d1.txt` |
| 18 | Standalone HTML prototype regression | `node scripts/verify-html-wave4.mjs` | **PASS** — 227 assertions | `logs/prototype-regression-html.txt` |

Every check was produced by `scripts/collect-t4-evidence.sh`. It records the command, the branch,
the SHA, the UTC execution time, the raw output and the real exit code in every file.

## The MySQL 8.4 environment

Docker is not installed on this machine, so MySQL 8.4.6 runs as the isolated Windows-archive
instance in `.tools/` (git ignored) that T3 set up, on port 3307 with its own data directory.
The pre-existing MySQL 8.0 installation was not touched.

| Property | Value |
| --- | --- |
| Version | MySQL Community Server 8.4.6 for Win64 |
| Port | 3307, bound to 127.0.0.1 only |
| Database | `codestrike`, plus the `codestrike_it_*` databases the test fixture creates and drops |
| Credentials | `apps/server/.env` and `.tools/`, both git ignored; never printed in this evidence |
| Migration | `alembic_version` = `0001` (head) |
| Isolation | `READ-COMMITTED`, which is what the concurrency check relies on |

The backend suite runs with **no skip**: 66 passed, 0 skipped. The seven MySQL checks that T1
had to skip against MySQL 8.0.37 all pass against MySQL 8.4.6.

## The full round trip

`test-results/student-app-e2e.txt` drives the real student client against the real backend and
the real database. Every run creates its own five accounts and its own competitions, so the suite
never depends on or disturbs the development data.

| Identity | Role in the run |
| --- | --- |
| Captain A | Creates the team, submits the recruitment revision, reviews and decides |
| Applicant B | Discovers the recruitment, applies, is approved, becomes an active member |
| Applicant C | Applies without a skill overlap, is rejected in one lane, withdrawn in another |
| Unauthorized Student | Never a member of the team; may not read the queue or the contacts |
| Test Administrator | Signs in with the provisioned administrator account and publishes the revision |

The round trip the suite proves:

1. The captain creates a team; the captain is already the first active member.
2. The captain submits the first recruitment revision; the recruitment is **not** public yet.
3. The administrator approves the revision through the real moderation endpoint; the
   recruitment becomes public and appears in the competition.
4. The applicant discovers the published recruitment and applies; the application is `Pending`.
5. A second application from the same student is refused with `DUPLICATE_PENDING`.
6. The captain reads the `Pending` queue, and only the sanitized applicant preview.
7. The captain approves; the applicant becomes an active member, and the member count is two.
8. The database read-back confirms the team, the membership rows, the application row and the
   approved revision row.

The negative cases are proved in the same run: a rejected application stays in the history, a
withdrawn application stays in the history, an incomplete profile cannot apply, a `Not Matched`
applicant may still apply, an unpublished competition and an unpublished or delisted recruitment
never appear publicly, a non-captain and a non-member may not read the review queue or the
protected contacts, and a team id in the URL grants no captain scope.

## Capacity and the last slot

The capacity check uses a team whose capacity is two, so the captain and one member fill it.

- Approving beyond the capacity is refused with `TEAM_FULL`, and the member count stays at the
  capacity.
- The last slot is taken by two approvals that run at the same time against real MySQL 8.4:
  exactly one succeeds, the other is refused with `TEAM_FULL`, and the team ends with two
  members and one captain. The competition row is locked first, so the two transactions
  serialise and the loser sees the committed membership.

`test-results/student-app-e2e.txt` contains both runs; `logs/database-state.txt` counts the
active membership rows directly in MySQL.

## Privacy

- The review queue returns the sanitized applicant preview only. The contact details of a
  member are a separate endpoint that requires the **captain** of that team, and it is refused
  with `FORBIDDEN` for a plain member and for a non-member.
- The captain view of My Teams does not contain the contact of the applicant. The browser run
  asserts this on the rendered screen.
- The Prototype Lab does not exist in API mode. `personaSwitchingAvailable` is `false` there,
  and the screens do not offer it, so a Mock persona can never be mistaken for a server
  identity. The Mock build keeps the Prototype Lab exactly as the Assignment 4 prototype had it.
- An unpublished competition, an unpublished recruitment and a delisted recruitment are absent
  from every public listing.

## Screenshots

`screenshots/` holds the eight PNG files of the real H5 flow, captured from the production API
mode bundle at 390 px against the running backend:

| File | What it shows |
| --- | --- |
| `A5_T4_01_Competition_List.png` | The competition list after the server side search for this run's competition |
| `A5_T4_02_Competition_Detail.png` | The competition detail of the real competition, with the real registration state |
| `A5_T4_03_Team_Created.png` | The team creation form filled with the server side skill catalogue |
| `A5_T4_04_Recruitment_Published.png` | The published recruitment inside the competition |
| `A5_T4_05_Application_Submitted.png` | The recruitment detail after the applicant applied |
| `A5_T4_06_Captain_Review.png` | The captain review queue with the applicant preview and the skill match |
| `A5_T4_07_Application_Approved.png` | The captain review after the approval was confirmed |
| `A5_T4_08_Team_Membership.png` | My Teams after the admission, without the contact of the applicant |

Every file was captured while the state it shows was real. The Mock build was never used for
these captures, and no image was edited.

## Burn-up

`burnup-data.csv` holds the raw numbers and `burnup-day3-day4.png` is drawn from it by
`scripts/plot-t4-burnup.py`, so the picture can always be reproduced from the data in this
repository.

| Date | Total scope | Accepted tasks |
| --- | --- | --- |
| 2026-11-21 | 9 | 0 |
| 2026-11-22 | 9 | 3 |
| 2026-11-23 | 9 | 3 |
| 2026-11-24 | 9 | 3 |

The accepted count is the number of sprint issues that GitHub records as closed on that day:
issues #1, #2 and #3 closed on 2026-11-22. **T4 is not counted**, because issue #4 is still open
at the time of this record: the branch is committed locally and the pull request has not been
merged yet. The days after 2026-11-24 are left empty on purpose, because the future of the
sprint is not predicted and no story points are invented.

## What the implementation changed

| Area | Change |
| --- | --- |
| `packages/api-contracts/src/api/dto.ts` | DTOs for the recruitment revision payload, the revision list, the team creation answer and the team history |
| `packages/api-contracts/src/adapters/index.ts` | Adapters that turn those answers into `MyTeamItem`, `ApplicationHistoryItem`, `RecruitmentManagementView` and `TeamOperationsView` |
| `apps/student-app/src/api/client.ts` | The T4 operations of the client now call the backend and report the server's own verdict |
| `apps/student-app/src/pages/**` | The Prototype Lab is hidden in API mode, the skill catalogue comes from the server, and the screens stop using Mock team ids |
| `apps/server/app/modules/teams/service.py` | The team history projection names its team, and the public recruitment list reports the viewer's own skill match |
| `apps/server/app/modules/teams/router.py` | The public recruitment list accepts an optional token for that match |

## Two gaps found in the backend and fixed

1. **The team history did not name its team.** `GET /me/team-history` returned the team name but
   not its id, so a client could not map a past membership onto a team. The projection now
   carries `teamId` and the team state, which makes the row self-sufficient. A regression test
   was added.
2. **The public recruitment list carried no skill match.** The list returned the teams without
   the `match` field, so every recruitment looked unmatched to a signed-in student. The route now
   accepts the optional token of the viewer and reports the real match. A token the server
   cannot use does not close a listing that is public anyway.

## What was NOT verified

- **No administrator screen was built.** The administrator moderation API is used by the
  end-to-end test and by the browser run, but the moderation interface itself is T6.
- **The mp-weixin build was compiled but not opened in WeChat Developer Tools.** The
  `uni.request` bridge is therefore verified by build and by the shared transport tests, not on
  a device.
- **The session was not verified on a physical device**, only in the H5 browser.
- **The community posts, planner and notifications were not wired to the API.** They are T5, T6
  and T7, and they still report that they are not served by the API.
- **The prototype recruitment review screen stays Mock only.** It is the isolated design
  review of the Assignment 4 prototype and has no public equivalent.
- **Issue #4 is still open.** The branch is committed locally; the pull request and the merge
  are the next step and were not performed in this round.

## Secrets

No token, password, hash or email address appears in this directory. The accounts the runs
create use generated throwaway passwords, and the request bodies in the browser log redact
them; the administrator credentials are read from the git ignored environment file. The only
personal fields in this directory are the name, college, study year and brief CV of the throwaway
applicant account, which the captain review screen is supposed to show.
