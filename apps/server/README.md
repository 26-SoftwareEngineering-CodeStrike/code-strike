# CodeStrike backend

FastAPI modular backend, MySQL 8.4 / InnoDB / utf8mb4, SQLAlchemy 2 and Alembic.
See [IMPLEMENTATION_REPORT.md](IMPLEMENTATION_REPORT.md) for scope, test evidence and integration gaps.
All commands below start in `apps/server`. No application startup creates tables.

## Normal development setup (Windows PowerShell)

Install Python 3.13 and Docker Desktop, then:

```powershell
py -3.13 -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
# Edit .env: set unique database passwords and DATABASE_URL. URL-encode credentials.
docker compose up -d mysql
docker compose ps
docker compose exec mysql sh -c 'MYSQL_PWD=$MYSQL_PASSWORD mysql -u$MYSQL_USER -D$MYSQL_DATABASE -e "SELECT VERSION()"'
. ./scripts/load-env.ps1
.venv\Scripts\python.exe -m alembic upgrade head
.venv\Scripts\python.exe scripts/provision_admin.py administrator
.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Do not recreate an existing healthy virtual environment. The provisioning command prompts for a
password, never promotes/overwrites an existing user, and is the only supported administrator
creation path. Public registration creates Student accounts only.

In another terminal with the same `.env` loaded, run the deadline worker:

```powershell
.venv\Scripts\python.exe scripts/expire_deadlines.py --interval 5
```

The worker invalidates expired Pending applications and closes recruitment without waiting for
a user request. Admission guards independently enforce the exact current deadline inside each
transaction; the five-second sweep interval is an operational default, not an SRS policy.
Owner queries and deadline changes also reconcile expiration. Supervise this worker alongside
the API in deployment. It does not send planner reminders.

Stop MySQL while retaining the named volume:

```powershell
docker compose stop mysql
# Or: docker compose down   (do not add -v unless intentionally deleting development data)
```

Swagger: `/api/v1/docs`; OpenAPI: `/api/v1/openapi.json`; health: `/api/v1/health`.
Health requires neither DATABASE_URL nor a reachable database. Other database-backed endpoints
return a structured error when configuration/database access is unavailable.

## Available isolated runtime in this workspace

The original `.venv` points to a missing Python 3.13.17 installation. It was preserved.
An isolated Python **3.13.9** and native MySQL **8.4.7** were prepared for actual verification:

```powershell
$python = '.tools/python313/python.exe'
& $python -m pip check
& $python -m pytest
```

The runtime uses `.test-venv/Lib/site-packages` through its `_pth` file; it is not an activatable
venv. All existing dependency pins were retained. Runtime/download artifacts are ignored by Git.
Native MySQL startup/shutdown details are in `.tools/RECOVERY.md`. Its loopback-only port 33084
and empty-password root are **isolated test settings**, never production settings. Docker Compose
instead requires nonempty configured credentials and maps localhost port 3307 by default.

## Tests and migration validation

```powershell
# Functional tests; MySQL-only checks explicitly skip if TEST_MYSQL_URL is absent.
& $python -m pytest -v

# Use a dedicated development/test MySQL account allowed to create test databases.
$env:TEST_MYSQL_URL = 'mysql+pymysql://root@127.0.0.1:33084/codestrike_test?charset=utf8mb4'
& $python -m pytest -v --junitxml=test-results/mysql.xml -o junit_family=legacy

# Against the application database after loading .env:
& $python -m alembic upgrade head
& $python -m alembic check
```

The MySQL fixture asserts server version 8.4, creates a uniquely named `codestrike_it_<uuid>`
database, runs Alembic migrations, and drops only that exact database it created. It does not
truncate the database named in TEST_MYSQL_URL. Never point test credentials at production.
SQLite is used only for fast functional tests, not as MySQL constraint/concurrency evidence.

## Configuration and behavior

- All timestamps without offsets are interpreted as UTC; competition inputs with offsets are
  normalized to UTC. Planner course/timed-plan times are local wall-clock values on actual dates.
- `SEMESTER_START_DATE` and `PERIOD_TIMES` must be configured for course entry. Week 1 is the
  Monday-based week containing the semester start date. `PERIOD_TIMES` is a JSON object mapping
  period numbers to `[start, end]` wall-clock strings. No university timetable is shipped.
  Missing configuration returns 503; to-dos/timed plans remain usable. Test timetables are fictional.
- Email binding is a separate verified step after registration: request `/auth/email/code`, then
  `/auth/email/verify`. Recovery works only with a successfully bound email. Codes are hashed,
  single-use, expiring, and rate limited. SMTP delivery occurs outside database transactions.
  Missing SMTP returns 503, never a simulated delivery success. Automated tests inject a mailer.
- Provisional defaults: token lifetime 86400 seconds, email-code lifetime 600 seconds, 5 verification
  attempts, 60-second resend cooldown, 10 identity attempts per 900-second window. Environment
  variables in `.env.example` override these; they are not approved SRS constants.
- Opaque bearer tokens have 256 bits of randomness; only SHA-256 token digests are stored.
  Passwords use salted PBKDF2-HMAC-SHA256 (600000 iterations). Logout revokes the presented token;
  password change/recovery revokes all account tokens and previous codes.
- Authentication reads occur inside service transactions. Admission writes lock competition,
  team and application in that order, using MySQL READ COMMITTED. Never remove the isolation
  setting without revisiting the concurrency tests.
- Posts accept JSON `images: [{dataBase64: "..."}]`: up to nine valid PNG/JPEG byte streams,
  each at most 5 MiB. Stored images are served only for the current public revision or to their
  owner/moderator. Parser limits (16 million pixels / 128 MiB decoded PNG) bound memory usage;
  baseline/progressive 8-bit JPEG is supported. Arbitrary attachments are not accepted.
- Recurrence batches are finite and capped at 520 occurrences per request as an operational
  limit. Each instance has its own date and state. Comments require login but not profile
  completeness; posts, team creation and applications require complete profiles.
- Configure `CORS_ORIGINS` for browser clients. Production HTTPS, SMTP credentials and deployment
  process supervision remain environment responsibilities.

## Frontend integration boundary

`GET /competitions` remains a plain array, and `/dashboard` retains the existing admin client's
five keys. Existing IDs are strings, and shared enums are unchanged. New requests use camelCase.
Errors match `{code, message, details?}`. No frontend or shared-contract files were changed.

Both current clients still default to MockTransport. Student HttpTransport currently has no
Authorization support and exposes only listCompetitions; the admin client has no HTTP transport.
The shared OpenAPI YAML only describes health. Consequently the implemented backend is available
for integration, but the existing clients are **not already connected**. Use live Swagger as the
backend interface reference until the shared contracts and clients are expanded in a separately
authorized frontend task. Auth responses provide `accessToken`; send it as `Authorization: Bearer ...`.

Ordinary moderation uses `/moderation/{revisionId}` with `action: Approve|Reject|Remove`;
recruitment moderation uses `/moderation/recruitments/{revisionId}/decision` with
`decision: Approved|Rejected`. These additions were not previously defined by the shared contract.
