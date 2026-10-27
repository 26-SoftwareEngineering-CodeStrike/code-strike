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

