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

