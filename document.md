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

