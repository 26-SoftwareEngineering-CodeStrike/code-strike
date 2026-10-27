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

## Wave 1 handoff recorded at that time

- UI-13 application history and the full Pending / Approved / Rejected / Withdrawn / Invalidated lifecycle.
- UI-14 captain review with exactly the five permitted pre-admission applicant fields.
- Approval-side capacity, deadline, membership and invalidation demonstrations.
- WeChat Developer Tools and physical-device visual verification.
- Other Assignment 4 pages outside UI-04, UI-05 and UI-09.

The first three items above are completed by the Wave 2 report below. Device QA and pages outside
the approved Wave 2 scope remain open.

# Phase 2 Wave 2 completion report

## Scope delivered

- Corrected the Wave 1 Delisted-detail leak by separating public and privileged Mock operations.
- Implemented UI-13 owner application history with Pending, Approved, Rejected, Withdrawn and
  Invalidated kept as distinct records.
- Implemented UI-14 current-captain review with a sanitized five-field applicant DTO, advisory skill
  matching and manual Approve/Reject controls.
- Added an isolated recruitment revision comparison requiring an explicitly selected, correctly
  scoped current-captain or admin design-review persona.
- Added a deterministic shared Mock business state machine and Node unit tests for the relevant
  BR-01 through BR-11 prototype scenarios.

## Deliberate limits

State is coherent across student pages only for the lifetime of the loaded prototype and resets on
a full reload. No backend endpoint, durable storage, authentication, database transaction or
concurrency guarantee was added. The prototype does not expose member contact details; its separate
post-admission contact contract is only a boundary definition for later work.

Responsive H5 evidence is retained under `docs/evidence/phase2-wave2`. WeChat production output was
built, but WeChat Developer Tools and a physical device were not used.

## Wave 2 traceability summary

| Rule | Prototype evidence |
| --- | --- |
| BR-01–03 | One active membership per competition; immutable history; approval invalidates other same-competition Pending records. |
| BR-04 | Fresh application guard checks publication, switch, capacity, deadline, lifecycle, membership and duplicate Pending. |
| BR-05 | Existing Pending approval rechecks validity/capacity/deadline/lifecycle but permits manual-close or revision-delisted scenarios. |
| BR-06 | Capacity includes captain; reaching full invalidates Pending without reviving old records later. |
| BR-07–08 | Delisted revision stays out of public DTOs; isolated review shows effective and draft versions separately. Full moderation workflow remains out of scope. |
| BR-09 | UI-14 returns exactly Name, College, Sex, Skill tags and Brief CV for the current captain's active Pending queue. |
| BR-10 | Captain transfer test removes the old captain's access and grants the successor access immediately. |
| BR-11 | Deadline/dissolution invalidate Pending and block admission; Wave 1 community remains readable. |

UI-13 traces FR-09, FR-12 and the owner-history portion of FR-13. UI-14 traces FR-08 through FR-11.
The isolated revision flow supports the Wave 2 correction and the recruitment-version aspect of
FR-14 without claiming a complete moderator workflow.

# Phase 2 Wave 3 completion report

## Scope delivered

- Replaced remaining static public-recruitment reads with dynamic projections from the shared Mock
  business state. Published-to-Delisted changes now remove an item from both list and direct detail
  immediately, without exposing its draft.
- Implemented UI-10 team creation with eligibility checks, captain-inclusive capacity and immediate
  captain membership. Optional recruitment submission enters review rather than publishing.
- Implemented UI-11 current/captained/historical team views and made Teams navigation open My Teams
  before linking to My Applications.
- Implemented UI-12 captain recruitment management with separate Effective and Draft values,
  switch control and isolated Admin review actions.
- Implemented UI-15 departure, removal, captain transfer and dissolution with immediate Mock
  authorization changes, retained history and a separate captain-only Active-member contact DTO.

## SRS traceability summary

| Requirement/rule | Wave 3 prototype evidence |
| --- | --- |
| FR-07, UI-10 | Team form validates Mock identity, profile, competition eligibility/deadline, current membership and captain-inclusive capacity. |
| FR-07, FR-12, UI-11 | Current and historical memberships are separate from application history; captain/member actions depend on live membership. |
| FR-07, FR-14, BR-07–BR-08, UI-12 | Effective values and revision draft remain separate; revision Delists public content; only isolated Admin review can approve/reject. |
| FR-12, BR-10–BR-11, UI-15 | Leave/remove/transfer/dissolve update membership, count and authorization; Pending records are invalidated when required, not deleted. |
| BR-04–BR-06 | New applications require a visible/open/non-full team; valid existing Pending approval survives manual closure but rechecks capacity and lifecycle. |
| BR-09 | Public and Pending DTOs omit private contacts; current-captain Active-member contacts use a distinct response. |

## Deliberate limits

All state is fictional and in memory. Reloading the application resets it. The Admin reviewer is an
explicit design-review persona, not production authentication or a complete administrator UI.
There is no database, transaction/concurrency proof, server-side team API, email, deployment,
WeChat Developer Tools run or physical-device verification. UI-20, Planner and Wave 4 remain out of
scope.

## Targeted remediation after external review

- Fresh application eligibility now includes profile completeness and the target competition's
  eligibility list without treating `CurrentCaptain` as a non-student global role.
- Rejected recruitment revisions retain their draft and review result but are not reviewable again
  until the current captain submits a new revision identifier.
- Recruitment approval now rejects a dissolved team, an expired competition, a missing current
  captain membership, stale capacity below active membership and capacity above the competition
  maximum before changing Effective or Published state.
- The corrected page mapping is UI-11 → FR-07/FR-12, UI-12 → FR-07/FR-14, and UI-15 →
  FR-12/BR-10/BR-11.

# Phase 2 Wave 4 completion report

## Delivered scope

- Exported standalone HTML versions of UI-04, UI-05 and UI-09 with manual MoDao handoff maps and
  no external runtime resources. These files are ready for user import; import success and native
  MoDao connections remain pending.
- Corrected captain queue and recruitment-review targeting so a student captaining teams in
  different competitions is authorized per explicit team, not by one implicit global team.
- Implemented UI-16 through UI-19 with shared private Mock occurrence state, Day/Week views, manual
  finite course repetition, Timed Plans, To-dos and single-occurrence actions.
- Added shared planner contracts and routed all page operations through Student API Client and
  MockTransport rather than direct page access to internal state.

## SRS traceability

| Prototype page or boundary | Final SRS mapping |
| --- | --- |
| Multi-team captain correction | FR-07-FR-12, BR-01, BR-10 |
| UI-16 Planner Day / Week | FR-18, BR-12 |
| UI-17 Manual Course Entry | FR-16, FR-19, BR-12 |
| UI-18 Timed Plan / To-do | FR-17, FR-18, FR-19, BR-12 |
| UI-19 Single Occurrence Actions | FR-19, BR-12 |
| Incomplete-profile planner access | FR-02 |

## Verified outcomes and limits

All 35 Mock tests passed, including 14 planner cases and the multi-team captain case. Contracts,
student and admin TypeScript checks passed. H5 and `mp-weixin` builds completed. Existing FastAPI
tests reported 2 passed. Standalone HTML checks passed at 320/390/430px; H5 Planner checks passed
at 320/390/430/680px, and retained screenshots were visually reviewed.

The root pnpm wrapper again requested an interactive modules-directory purge and was not allowed to
modify installed dependencies; repository-local executables were used. DCloud retained its known
non-fatal circular-dependency warning. HTML generation is not MoDao import, H5 success is not a
WeChat real-device result, and Mock authorization is not production server authorization.

## Remaining Assignment 4 gaps

Pages outside the authorized Wave 1-Wave 4 scope, UI-20 Notifications, real authentication,
production APIs, persistence, database transaction/concurrency enforcement, WeChat Developer Tools
QA, physical-device QA and manual MoDao import/linking remain unimplemented or unverified.

