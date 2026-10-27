# CodeStrike Campus Competition and Activity Community

CodeStrike is a pnpm monorepo containing a uni-app student client, a Vue administration client and a
FastAPI modular-monolith foundation. Phase 1 is intentionally Mock-driven for the Assignment 4
interaction prototype. It does not connect to MySQL or implement full business workflows.

## Repository layout

```text
apps/
  student-app/       uni-app Vue 3 TypeScript client for H5 and mp-weixin
  admin-web/         Vue 3 Vite Element Plus administration shell
  server/            FastAPI Pydantic SQLAlchemy Alembic foundation
packages/
  api-contracts/     shared enums DTOs fictional fixtures and OpenAPI draft
docs/
  architecture/adr/ architecture decisions and deferred database constraints
  design/            Assignment 4 prototype specification
  evidence/          retained local prototype screenshots and evidence notes
  requirements/      Assignment 3 final SRS
prototype/           reserved prototype exports and assets
log/                 factual execution logs
scripts/             dependency-free local prototype QA helpers
```

## Prerequisites

- Node.js 22.23.2 or a compatible Node 22 LTS release
- pnpm 11.24.0 through Corepack
- Python 3.13
- No database is needed for Phase 1

MySQL 8.4 LTS is a Phase 2 integration target. Do not point Phase 1 commands at an existing MySQL
service.

## Install workspace dependencies

```powershell
pnpm.cmd install
```

The workspace permits build scripts only for `core-js`, `core-js-pure` and `esbuild` in
`pnpm-workspace.yaml`. Dependencies are locked in `pnpm-lock.yaml`.

## Student app

```powershell
pnpm.cmd dev:student:h5
pnpm.cmd dev:student:mp-weixin
pnpm.cmd build:student:h5
pnpm.cmd build:student:mp-weixin
```

The WeChat build output is `apps/student-app/dist/build/mp-weixin` and can be imported into WeChat
Developer Tools. Assignment 4 Wave 1 implements the Mock-only path from Competition Hub to
Competition Detail / Community, its public Recruitment list and Recruitment Detail. Reusable
student components live in `apps/student-app/src/components`; all displayed competition, team and
state data is fictional and comes through `MockTransport`. No student page calls the backend.

Wave 1 includes explicit Published, expired-registration, skill-match, full and manually closed
public scenarios. Wave 2 corrected the original prototype preview boundary: Delisted recruitment is
excluded from both public lists and public detail lookup.

Wave 2 adds UI-13 My Applications, UI-14 Captain Review and an isolated recruitment design-review
flow. Application and membership state persists in memory while the prototype is open. Explicit
Mock personas demonstrate owner/captain scope, five application states, approval invalidation and
the exact five-field Pending applicant DTO. Only the explicitly selected scoped Team Delta captain
or admin reviewer persona can request the Delisted revision comparison. These are client-side Mock
checks, not real authentication or server authorization.

Wave 3 adds UI-10 Create Team, UI-11 My Teams, UI-12 Recruitment Management and UI-15 Team Member
Operations. Public recruitment list/detail data is derived on every read from the same in-memory
team state used by captain operations. Effective approved settings and draft revisions are
separate; Delisted, Private and Pending content is denied by public operations. Captain transfer,
member departure/removal and dissolution update Mock memberships and permissions immediately.
These flows reset on full reload and do not represent production authorization or persistence.

## Prototype browser evidence

Responsive H5 screenshots are stored under `docs/evidence/phase2-wave1`, `phase2-wave2` and
`phase2-wave3`. The repository-local
scripts `scripts/capture-h5.mjs` and `scripts/verify-h5-flow.mjs` use the browser DevTools protocol
without adding a package dependency. They are QA utilities, not application runtime code.

## Administration web app

```powershell
pnpm.cmd dev:admin
pnpm.cmd build:admin
```

The app provides a basic responsive administration shell, router, dashboard placeholder and
MockTransport. No real administrator login is implemented.

## Mock state tests

```powershell
pnpm.cmd --filter @codestrike/student-app test:mock
```

The zero-dependency Node tests exercise deterministic Mock business scenarios. They do not prove
database constraints, concurrent correctness or production authorization.

## FastAPI server

Create or refresh the isolated environment from the repository root:

```powershell
python -m venv apps\server\.venv
apps\server\.venv\Scripts\python.exe -m pip install pip-tools==7.5.2
apps\server\.venv\Scripts\python.exe -m pip install -r apps\server\requirements.txt
```

Start the API:

```powershell
Set-Location apps\server
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

Health endpoint: `GET http://127.0.0.1:8000/api/v1/health`

The application can start without `DATABASE_URL`. Database engine creation is lazy and raises a
clear configuration error if a future database-backed dependency is requested without a URL.

## Checks

```powershell
pnpm.cmd type-check
pnpm.cmd build
Set-Location apps\server
.\.venv\Scripts\python.exe -m pytest
.\.venv\Scripts\python.exe -m pip check
```

No command in Phase 1 or the Assignment 4 prototype waves performs an Alembic migration or creates
database tables.

