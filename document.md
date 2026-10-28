# Phase 1 engineering notes

## Scope

Phase 1 establishes a runnable Mock foundation for the Assignment 4 prototype. Only one student
startup page, a small administration layout and `GET /api/v1/health` are implemented. UI-01 through
UI-27 and the complete business backend remain outside this phase.

## Frontend boundaries

The student client keeps the exact DCloud Vue 3 Vite TypeScript package train generated from the
official `vite-ts` template. It builds H5 and `mp-weixin` from one source tree. General client code
uses uni-app APIs rather than browser-specific networking or storage APIs.

The administration client uses its own Vue Vite TypeScript toolchain and Element Plus. Its versions
are not imposed on the DCloud project.

Both clients depend on `@codestrike/contracts`. Formal DTOs and enums are exported from the package
root; fictional prototype fixtures are available only from the `/mock` export. Each app owns a
small `ApiTransport` abstraction and currently selects `MockTransport`.

## State vocabulary

Application states are exactly `Pending`, `Approved`, `Rejected`, `Withdrawn` and `Invalidated`.
They are not reused for current membership. Separate enums model membership, recruitment
publication, recruitment switch, team lifecycle and competition deadline state.

## Backend boundaries

The FastAPI router handles HTTP concerns only. Future modules follow router, schema, service,
repository, model and policy layers. Command services own `with session.begin():` and must start it
before the first database operation. Repositories never commit or roll back.

The engine and Session factory are lazy. Importing the app and calling the health endpoint do not
read `DATABASE_URL` or connect to a database. No ORM model or migration is present in Phase 1.

## Deferred MySQL design

MySQL 8.4 integration is deferred. The conditional uniqueness ADR records generated-column and
separate-current-table options without using PostgreSQL partial indexes. A MySQL 8.4 test must prove
the chosen strategy for one active competition membership and one Pending team application before
any migration is accepted.

# Assignment 4 Phase 2 Wave 1 engineering notes

## Implemented prototype scope

Wave 1 implements UI-04 Competition Hub, UI-05 Competition Detail / Community and UI-09
Recruitment Detail in the existing uni-app student client. Navigation follows Competition Hub to
Competition Detail, the Recruitment tab and Recruitment Detail. Other navigation targets return
explicit prototype-boundary feedback instead of acting as silent controls.

The pages share header, bottom navigation, status, state, competition-card and recruitment-card
components. The same source builds for H5 and `mp-weixin`; application code does not use browser-only
storage, networking or navigation APIs.

## Mock contract and rule coverage

The shared contract now defines competition detail, recruitment summary/detail, advisory match and
display availability DTOs. Fixtures model Published and expired competitions plus Published/Open,
Matched, Not Matched, Full, Manually Closed, Registration Closed and Pending Revision / Delisted
recruitment combinations.

The public recruitment query excludes the Delisted fixture. A labelled prototype-only moderation
preview exposes its effective and draft values for Assignment 4 demonstration without representing
it as public content. Not Matched remains eligible to apply. Full uses the required feedback “This
team is full.” Registration expiry blocks the prototype application action but leaves the community
and existing records readable. No contact information is present in fixtures or public views.

The Apply interaction uses a Visitor / Complete Student demo persona. It returns only a local Mock
Pending result and explicitly states that no account, server or database workflow ran. Captain
approval, invalidation of other applications and the complete five-state application lifecycle
remain Wave 2 work.

## Verification boundary

H5 was visually inspected at 320, 390, 430 and 680 CSS pixels using Edge DevTools device metrics.
The retained screenshots cover the Hub, community overview, recruitment list, expired community,
open Not Matched recruitment and Delisted revision comparison. A browser script exercised the main
click path, public-list privacy boundary, Match/Full states, Mock Pending feedback, failure state and
empty search state.

The `mp-weixin` production build passed, but no WeChat Developer Tools or physical-device visual QA
was performed. DOCX requirement content was extracted with Pandoc; DOCX visual rendering was not
available because the local document-rendering dependencies were absent.

# Assignment 4 Phase 2 Wave 2 engineering notes

## Public and design-review boundaries

Public recruitment list and detail operations return only publicly listed fixtures. Delisted Team
Delta and its draft revision are available through a separate design-review operation that checks
the explicitly selected in-memory actor. The actor must be Admin or the current captain scoped to
that team. Route query values are ignored for actor selection. The public operation stays denied
even after a privileged design-review persona has been selected.

This is deliberately a UI prototype boundary. It does not implement or claim backend authentication
or authorization. A production server must independently derive identity and scope for every
request.

## Shared Mock state

The student application owns one in-memory state machine shared by UI-09, UI-13, UI-14 and the
isolated review page. It models application status, active/ended membership, team lifecycle,
recruitment publication, recruitment switch, competition deadline, capacity including captain and
the selected actor independently. Named scenarios cover manual close, revision delisting, full,
deadline expiry, dissolution, captain transfer and former membership.

Fresh applications require a public/open/active/not-full recruitment before the deadline and no
current membership or duplicate Pending record. Approval of an existing Pending record deliberately
does not require the recruitment to remain public/open, but rechecks Pending validity, active team,
deadline, current membership and capacity. Approval creates a Mock current membership and
invalidates other Pending applications for that student in the same competition. Reaching capacity,
deadline expiry and dissolution invalidate affected Pending records without rewriting history.

Pending captain responses use `CaptainPendingApplication` with the nested
`PendingApplicantProfile`. That profile can carry only Name, College, Sex, Skill tags and Brief CV.
The separate `ActiveMemberContact` contract prevents a Pending response model from accidentally
growing contact fields.

# Assignment 4 Phase 2 Wave 3 engineering notes

## One Mock source of truth

The public recruitment list, public detail, captain review, team creation, My Teams, recruitment
management and member operations now read and mutate `mockBusinessState`. Public recruitment DTOs
are derived at request time only when the team is Active and its publication is Published. Draft
revision values are returned only by the isolated, permission-checked review operation; they are
not fields of the public DTO. A Published recruitment submitted for revision becomes Delisted
immediately while its previously approved Effective settings remain available for evaluating an
already Pending application.

The selected prototype persona is still only an in-memory demonstration identity. Every state
operation rechecks its role, current captain/member relationship and team scope; route parameters
do not grant authority. A production API must repeat these checks using authenticated server-side
identity and transactional persistence.

## Team lifecycle rules represented

UI-10 validates the Mock login/profile/eligibility/deadline/current-membership constraints and
capacity including the captain. A successful creation establishes an Active captain membership;
optional initial recruitment submission is Pending, not automatically public.

UI-11 derives current and historical teams from membership records rather than application
history. UI-12 keeps lifecycle, publication and recruitment switch distinct, validates capacity
against active members and competition limits, and uses an isolated Admin reviewer for prototype
approval/rejection. Manual closure blocks only new applications, so a still-valid existing Pending
record can be approved. Approval at capacity closes the switch and invalidates competing Pending
records without deleting history.

UI-15 supports ordinary-member departure, captain removal of another member, captain transfer to
an existing Active member and team dissolution. A captain cannot leave directly. Transfer changes
authorization immediately; dissolution ends active memberships and invalidates Pending
applications. Departure, removal and capacity changes do not reopen recruitment or revive old
applications. Member contacts use a separate DTO available only to the current captain for Active
members.

## Verification boundary

The deterministic state tests cover the required transitions and privacy DTOs. H5 browser checks
exercise the public-state correction and the four Wave 3 pages, including direct-URL permission
denial and fixed-navigation clearance at 320, 390, 430 and 680 CSS pixels. Screenshots are retained
under `docs/evidence/phase2-wave3`. The `mp-weixin` output is build-checked only; WeChat Developer
Tools and physical-device behavior remain unverified. No MySQL connection, migration, real
authentication, backend team endpoint or durable data was added.

## Wave 3 targeted boundary remediation

Fresh applications now recheck both profile completeness and target-competition eligibility before
creating a Pending record. A current captain remains a student identity for a different
competition; the one-current-team rule is evaluated within the target competition rather than from
the actor's global display role.

Recruitment drafts carry an internal revision identifier and retain an isolated moderation history.
A Rejected draft remains unavailable publicly and cannot be approved directly. The current captain
must resubmit it as a new Pending revision before another Admin decision. Immediately before
promotion, approval rechecks the current revision state, Active team lifecycle, unexpired
competition deadline, current captain membership, active-member count and competition capacity.

The corrected final-SRS traceability for the remediated Wave 3 pages is:

| Prototype page | Final SRS mapping |
| --- | --- |
| UI-11 My Teams | FR-07, FR-12 |
| UI-12 Recruitment Management | FR-07, FR-14 |
| UI-15 Team Operations | FR-12, BR-10, BR-11 |

# Assignment 4 Phase 2 Wave 4 engineering notes

## Standalone HTML handoff

UI-04, UI-05 and UI-09 now have standalone HTML renderings under
`prototype/html/wave4-pilot`. Each file contains complete DOM, inline styling and fictional local
data, and has no runtime dependency on Vue, Vite, Node, a server, a remote image or a network API.
The accompanying page, interaction, token and import guides describe manual MoDao conversion and
the navigation/state connections that the user must verify or recreate. Status is
`HTML_EXPORT_READY / MODAO_MANUAL_IMPORT_PENDING`; no MoDao operation was performed.

## Multi-team captain scope

Captain queue reads now accept an explicit team identifier and reauthorize against that team's
current Active Captain Membership. UI-11 supplies the selected team ID and UI-14 preserves an
explicit target across persona changes. Its no-ID compatibility route follows the explicitly
selected captain persona instead of silently retaining a different team's queue. Transfer removes
the old captain's target-team authority immediately and grants it to the new captain. Pending
applicant DTOs remain restricted to Name, College, Sex, Skill tags and Brief CV.

## Planner behavior and privacy

The planner reuses the existing Mock actor identity and keeps occurrence rows in a separate
in-memory state module. UI-16 Day and Week views query the same rows. UI-17 creates finite weekly
course occurrences from the actual start week and uses the exact duplicate key Course Name +
Actual Date + Start Time + End Time. UI-18 permits overlapping Timed Plans and no-deadline To-dos.
UI-19 edits, deletes or completes only the selected stable occurrence ID.

Planner access follows FR-02 and FR-16 through FR-19: signed-in students, including the incomplete
profile persona, can access only their own data; Visitor and Admin reviewer personas are denied.
No automatic competition task, reminder or notification is generated. The period table is labelled
Example / Mock and is not represented as an official Fuzhou University schedule.

## Wave 4 verification boundary

The deterministic suite has 21 business-state and 14 planner-state tests. Final contracts, student
and admin type checks passed. H5 and `mp-weixin` production builds passed with the existing DCloud
circular-dependency warning. Existing FastAPI tests reported 2 passed with one known TestClient
deprecation warning. Browser regression passed the Wave 1/2 flow, the Wave 3 flow and the Wave 4
Planner flow; production-build screenshots cover 320, 390, 430 and 680 CSS pixels. The WeChat output was
not opened in Developer Tools or tested on a physical device.

The Mock checks do not prove real authentication, server authorization, database transactions,
concurrency behavior or persistence. MySQL and Alembic were not accessed.

# Design Wave D1 implementation coverage

Design Wave D1 changes only UI-04 Competition Hub, UI-05 Competition Detail / Community, UI-09
Recruitment Detail, UI-11 My Teams, UI-16 Personal Planner and necessary shared presentation
components. The original routes, API calls, Mock business state, planner calculations and
authorization checks remain unchanged.

The product layer now uses a compact app bar and bottom navigation, a consistent token palette,
15–16 px body typography, limited status badges, 44 px primary controls and product-facing state
copy. Demo actor and scenario controls remain explicitly selectable but are isolated in a collapsed
Prototype Lab. URL parameters still do not select a privileged actor, and the UI does not claim
real authentication or backend authorization.

The production H5 output was checked at 320, 390, 430 and 680 CSS pixels for overflow, wrapping,
active navigation, CTA presence and fixed-navigation clearance. UI-04 empty/error states and UI-16
Day/Week selection were exercised. Representative 390 px screenshots are retained under
`docs/evidence/design-wave-d1`; temporary baseline and extra-width captures were not added to Git.

# Design Wave D1.1 implementation coverage

D1.1 refines the existing D1 pages and shared components in place. Bottom navigation now presents
meaningful discover, teams, planner and profile icons with persistent labels and safe-area-aware
clearance. UI-05 exposes Overview, Discussion, Resources and Recruitment simultaneously at 320 px;
its visible community counts remain values returned by the existing Mock contract. UI-09 reduces
secondary card fragmentation, UI-11 keeps role-gated actions in a compact group, and UI-16 improves
chronological scanning without changing calendar calculations or planner mutations.

Demo actors and scenarios open through a consistent header control into Prototype Lab. Selection
remains explicit, the sheet states that switching is not authentication or server authorization,
and URL parameters still cannot grant a privileged actor. Production H5 rectangle checks confirm
that the final card/action/occurrence clears the fixed navigation at 320, 390, 430 and 680 px.

## D1.1 final layout correction

The five pilot page containers now preserve 16 px horizontal padding on 320, 390 and 430 px H5
viewports by separating top/horizontal padding from legacy and current safe-area bottom fallbacks.
At 680 px the existing 36-40 px responsive padding remains. Automated production-browser checks
measure both computed padding and the left/right rectangles of page goals, inputs, tabs, cards,
lists and action groups. UI-05 keeps four complete tab labels and 44 px targets at 320 px. This was
a presentation-only correction; Mock, planner, API, lifecycle, authorization and navigation logic
were not changed.

