# CodeStrike Phase 1 initialization report

## A Initial Repository Baseline

The repository initially contained empty application and package directories plus the Assignment 3
SRS and Assignment 4 prototype specification. Git had no commits, no remote and only `docs/` as
untracked content. Local MySQL was not accessed or changed.

## B Created Project Structure

Created a pnpm workspace with `student-app`, `admin-web` and `api-contracts`; initialized the
FastAPI package, tests, architecture ADRs and root engineering documentation.

## C Installed and Locked Dependencies

Frontend dependencies are locked by `pnpm-lock.yaml`. The DCloud package train remains
`3.0.0-5020620260917001` with its template Vite 5.2.8 and TypeScript 4.9.5. Admin uses Vue 3.5.44,
Vite 8.3.5, TypeScript 6.0.3 and Element Plus 2.14.7.

The isolated Python 3.13.9 venv uses the exact versions in `requirements.txt`, including FastAPI
0.162.0, Pydantic 2.14.1, SQLAlchemy 2.0.55, Alembic 1.20.1 and PyMySQL 1.2.3. pip-tools generated
an exact transitive lock. Hash generation was not retained because the configured mirror failed
while pip-tools downloaded unrelated platform wheels; ordinary Windows installation succeeded.

## D Student H5 and mp-weixin Build Evidence

`uni build` completed successfully and wrote the H5 output under `dist/build/h5`.
`uni build -p mp-weixin` completed successfully and wrote the WeChat output under
`dist/build/mp-weixin`. Both emitted a non-fatal circular-dependency property warning from the
DCloud compiler dependency chain.

## E Admin Web Build Evidence

`vue-tsc -b && vite build` completed successfully. Vite transformed 1,605 modules. The current
all-at-once Element Plus import produces a chunk-size warning; Phase 2 should add on-demand imports
or route-level splitting.

## F FastAPI Health Check Evidence

Uvicorn started on `127.0.0.1:8010`. `GET /api/v1/health` returned HTTP 200 with
`{"status":"ok","service":"CodeStrike API","api_version":"v1"}`. OpenAPI also returned HTTP 200.
The temporary server process was stopped after verification.

Pytest reported 2 passed tests and one Starlette warning that the compatibility TestClient path is
deprecated in favor of a future `httpx2` dependency. `pip check` reported no broken requirements.

## G Mock and API Contract Foundation

Shared types distinguish Application, Membership, Recruitment Publication, Recruitment Switch,
Team Lifecycle and Competition Deadline. Mock fixtures use fictional competitions and teams.
Student and admin applications access fixtures through separate MockTransport implementations.

## H Changes and Files Created

Created root workspace configuration, both frontend foundations, the FastAPI skeleton, exact lock
files, shared contracts, two ADRs, tests and factual project documentation. Generated build outputs,
node_modules and the Python venv are ignored by Git.

## I Remaining Risks and Blockers

- MySQL 8.4 is not installed or tested; no database work was attempted.
- DCloud compiler emits a non-fatal circular dependency warning.
- Admin output has a large JavaScript chunk due to full Element Plus registration.
- FastAPI TestClient emits a dependency deprecation warning.
- No browser or WeChat Developer Tools visual/device QA was performed in the CLI environment.
- Business endpoints, authentication, migrations and UI-01 through UI-27 remain unimplemented.

## J Final Git Status

No files were staged, committed or pushed. See the final CLI report and `log/2026-10-26.md` for the
exact status captured after validation.

## K Proposed Phase 2 Plan

1. Confirm unresolved SRS parameters without inventing defaults.
2. Produce the approved Assignment 4 high-fidelity flows using the established MockTransport.
3. Add OpenAPI contract generation and drift checks.
4. Run a MySQL 8.4-only schema spike for conditional uniqueness and concurrency.
5. Implement identity, competition and team use cases incrementally with service-owned transactions.

# Phase 2 Wave 1 completion report

## Scope delivered

Implemented the first Assignment 4 high-fidelity prototype path in the student client:

1. UI-04 Competition Hub with Published-only search, loading, empty and failure feedback.
2. UI-05 Competition Detail / Community with Overview, Discussion, Resources and Recruitment tabs.
3. UI-09 Recruitment Detail with Match, capacity, switch, deadline and publication feedback.

All data remains deterministic and fictional. The student application still uses MockTransport and
does not call FastAPI, authenticate a real user or connect to MySQL.

## Business-state treatment

The public list contains only publicly listed recruitment. Team Delta's Pending Revision / Delisted
state is available through a labelled prototype-only moderation preview and shows approved effective
values separately from draft values. Team Beta demonstrates that Not Matched does not block an
application. Team Gamma is Full, Team Epsilon is manually closed and the archived competition
demonstrates that a passed deadline does not close its community.

Wave 1 does not claim captain approval, concurrency enforcement, invalidation or durable application
history. A successful prototype application changes only local page state to Mock Pending.

## Verification results

- Shared contracts, student app and admin app TypeScript checks passed.
- Final H5 production build passed.
- Final `mp-weixin` production build passed with the existing DCloud circular-dependency warning.
- Browser verification completed 14 assertions across the primary flow and key empty/error/status states.
- H5 screenshots at 320, 390, 430 and 680 CSS pixels were generated and visually inspected.
- Existing FastAPI tests reported 2 passed and one known TestClient deprecation warning.
- `pip check` reported no broken requirements.

The root `pnpm type-check` wrapper initially stopped before compilation because pnpm requested an
interactive `node_modules` purge in a non-TTY session. No reinstall was performed; the installed
workspace executables were invoked directly and all three type checks passed.

## Remaining Wave 2 work

- UI-13 application history and the full Pending / Approved / Rejected / Withdrawn / Invalidated lifecycle.
- UI-14 captain review with exactly the five permitted pre-admission applicant fields.
- Approval-side capacity, deadline, membership and invalidation demonstrations.
- WeChat Developer Tools and physical-device visual verification.
- Other Assignment 4 pages outside UI-04, UI-05 and UI-09.

