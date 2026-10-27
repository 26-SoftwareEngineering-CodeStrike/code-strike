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

Wave 1 includes explicit Published, expired-registration, skill-match, full, manually closed and
revision-delisted scenarios. The Delisted fixture is excluded from the public list and is reachable
only from a clearly labelled prototype moderation preview.

## Prototype browser evidence

Responsive H5 screenshots are stored under `docs/evidence/phase2-wave1`. The repository-local
scripts `scripts/capture-h5.mjs` and `scripts/verify-h5-flow.mjs` use the browser DevTools protocol
without adding a package dependency. They are QA utilities, not application runtime code.

## Administration web app

```powershell
pnpm.cmd dev:admin
pnpm.cmd build:admin
```

The app provides a basic responsive administration shell, router, dashboard placeholder and
MockTransport. No real administrator login is implemented.

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

No command in the Phase 1 or Assignment 4 Wave 1 setup performs an Alembic migration or creates
database tables.

