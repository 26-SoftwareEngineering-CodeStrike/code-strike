# Backend implementation report — 2026-11-08

## Delivery and boundaries

Implemented database-backed accounts, profiles, skills, competition maintenance/submissions,
competition communities, posts/comments and versioned moderation, likes/favorites, teams and
recruitment, applications/captain decisions, current-role privacy, notifications and private
planner occurrences. The existing FastAPI application and health endpoint were retained.

Changes are confined to `apps/server/**` and the verified decision in ADR 0002. No frontend,
shared contracts, SRS/design documents, frontend dependencies, branch or Git commits were changed.
Branch remains `feature/backend-implementation`; changes are uncommitted.

## Main API groups

All paths below are relative to `/api/v1`; live Swagger lists all methods and request fields.
There are 58 paths / 78 documented API operations, including health.

| Capability | Main paths |
|---|---|
| Accounts | `/auth/register`, `/auth/login`, `/auth/me`, `/auth/logout`, `/auth/password/change`, `/auth/email/code`, `/auth/email/verify`, `/auth/password/recovery/code`, `/auth/password/recovery` |
| Profiles and skills | `/profiles/me`, `/skills`, `/skills/{id}` |
| Competitions | `/competitions`, `/competitions/{id}`, `/admin/competitions`, `/competition-submissions`, `/competition-submissions/me` |
| Content | `/competitions/{id}/posts`, `/posts/{id}`, `/posts/{id}/comments`, `/comments/{id}`, `/posts/{id}/interactions/{kind}`, `/images/{id}`, `/me/posts`, `/me/favorites` |
| Teams | `/teams`, `/teams/{id}`, `/me/teams`, `/me/team-history`, `/competitions/{id}/recruitments`, `/teams/{id}/recruitment/revisions`, `/teams/{id}/recruitment/switch` |
| Admission | `/teams/{id}/applications`, `/applications/{id}/decision`, `/applications/{id}/withdraw`, `/applications/{id}/applicant-profile`, `/me/applications` |
| Members | `/teams/{id}/members`, `/teams/{id}/members/{userId}/contact`, `/teams/{id}/leave`, `/teams/{id}/captain`, `/teams/{id}/dissolve` |
| Moderation | `/moderation`, `/moderation/{revisionId}`, `/moderation/recruitments`, `/moderation/recruitments/{revisionId}`, `/moderation/recruitments/{revisionId}/decision` |
| Notifications | `/notifications`, `/notifications/{id}` (recipient-only list/detail/read-state) |
| Planner | `/planner/items`, `/planner/items/{id}`, `/planner/day`, `/planner/week` |
| Administration | `/dashboard` (existing count contract, no additional analytics) |

The applicant preview has exactly name, college, sex, skills and briefCv. Contact details use
a distinct endpoint requiring the current captain and current active membership. Former captains,
withdrawn/invalidated applicants and departed members have no inherited access. Notifications
contain non-sensitive summaries and target IDs only; following a target invokes its current
authorization checks. Administrators have no arbitrary profile or private planner endpoint.

## Database and transactions

26 tables:

- `users`, `auth_tokens`, `auth_attempts`, `email_codes`;
- `profiles`, `skills`, `profile_skills`;
- `competitions`, `communities`, `competition_submissions`, `competition_submission_revisions`;
- `posts`, `post_revisions`, `comments`, `comment_revisions`, `content_images`, `post_interactions`;
- `teams`, `team_skills`, `memberships`, `recruitment_revisions`, `applications`;
- `moderation_records`, `notifications`, `planner_recurrences`, `planner_items`.

Teams hold effective recruitment state and revision pointers. Membership rows are historical
episodes with Active/Ended states, independent from historical application outcomes. Parent
foreign keys, composite competition/team and comment/post ownership keys, unique catalogs,
community uniqueness, interaction primary keys and planner duplicate guards protect references.

Stored generated nullable guard columns enforce one Active membership per student/competition
and one Pending application per applicant/team while allowing multiple terminal historical rows.
Actual MySQL 8.4 tests verified NULL behavior and generated columns. ADR 0002 records the selected
approach and the rejected alternative of separate current-relation tables.

Competition-row locking serializes admission within a competition. Services use explicit
`with session.begin()`; repositories/dependencies never commit. MySQL READ COMMITTED avoids stale
snapshot revalidation after waiting for a lock. Application outcomes, membership changes and
notifications commit together. Full teams close recruitment and invalidate remaining Pending
applications with the exact message `This team is full.`. A departure/capacity increase never
reopens recruitment automatically. Expiration is reconciled by guarded operations and a supplied
deadline worker; extending an expired deadline first persists invalidation.

Migration `0001_initial_mandatory_backend_schema.py` contains explicit Alembic table/constraint
operations, not startup create_all. It was applied to real MySQL, and `alembic check` reported
no pending schema differences. Test-only SQLite fixtures use create_all for functional tests.

## Executed verification

Environment: Windows, Python 3.13.9, native MySQL 8.4.7 on loopback, InnoDB/utf8mb4,
existing FastAPI/Pydantic/SQLAlchemy and all 29 locked dependency versions retained.
The supplied `.venv` was broken because its base Python path was missing; isolated ignored
runtime directories were prepared instead of replacing it. `pip check`: no broken requirements.

Final full MySQL run: **64 passed, 0 failed, 0 skipped**, 102.11 seconds.
Local machine-readable evidence: `test-results/mysql.xml` (ignored test artifact).
The existing two tests remain included. Each database-backed fixture used an isolated migrated
MySQL database. The only warning was the existing Starlette/httpx TestClient deprecation; pins
were not changed to suppress it.

Production dependency wiring was also exercised without TestClient dependency overrides:
health, competition reads, registration, current-user lookup and planner creation succeeded
against real MySQL. This caught and fixed the baseline Session dependency's missing factory
invocation. Two regression tests now cover Session creation and database-independent health.

Tests cover registration/duplicate/login/password/logout, verified email binding/recovery,
invalid/expired/reused/exhausted codes and unavailable SMTP; each missing profile field;
catalog reference preservation; content publication and stale/removed revisions; image structure,
9/10 count and exact 5 MiB limit; competition changes; team/applicant privacy; membership/history;
capacity/deadline/recruitment differences; notifications and private planner recurrence/ownership.

Five MySQL-specific integrity tests exercise stored nullable unique guards and simultaneous
last-place approvals, cross-team admission of one applicant, duplicate application submission,
concurrent creation and withdrawal-versus-approval. Planner concurrent duplicate insertion is
also tested on MySQL. SQLite tests do not substitute for these results.

Recorded local 20-user workload: **80 API operations, 0 failures**, maximum **0.5491 s**, p95
**0.5342 s**. Each concurrent user performs a competition read, planner save, application and
moderation operation. Per-kind maxima: read 0.5491 s, save 0.1075 s, apply 0.2829 s, moderation
0.0436 s. These measurements use in-process ASGI TestClient and a local database; they meet the
3-second target in this narrow recorded environment, not production/network/client acceptance.

## Requirement coverage and limits of evidence

| SRS scope | Implementation / evidence |
|---|---|
| FR-01–03, AC-01–08 | Auth/profile/skill services; auth_codes, auth_profiles, profile-gate tests. No real SMTP provider or H5/Mini Program login acceptance run. |
| FR-04–06, AC-09–18 | Competition/community/content services; content_moderation and content_extended tests. |
| FR-07–12, AC-19–42 | Team/recruitment/application services; teams and mysql_integrity tests. Current privacy projections verified at API level. |
| FR-13–15, AC-43–51 | Notifications, revision moderation and admin role checks. Tests cover routing/read states, obsolete links through protected target APIs, content/recruitment revision differences. |
| FR-16–19, AC-52–61 | Planner service and 25 planner tests, including real MySQL duplicate concurrency. |
| BR-01–12, UC-01–09 | Implemented by these backend workflows. UI/device end-to-end scenarios are not claimed complete. |
| NFR-01 / AC-62 | Shared persisted API/account model; existing frontend clients remain Mock-driven. Cross-client device acceptance unexecuted. |
| NFR-02–03 / AC-63–64 | API authorization/privacy and real MySQL concurrency tests; UI-level enforcement remains frontend work. |
| NFR-04 / AC-65 | Recorded 20-user local workload above; production/network target not established. |
| NFR-05 / AC-66 | Structured backend errors and empty results; overlapping planner records retained. Visual usability untested. |
| NFR-06 / AC-67 | Reproducible tests, JUnit evidence, actual environment/results and explicit exclusions recorded. |

This is backend delivery, not a claim that all 67 complete product acceptance cases have passed.
No mandatory backend domain module was intentionally omitted. Frontend integration, UI/device
acceptance, real external email delivery and deployment operations remain outside executed evidence.

## Remaining configuration and integration work

1. Configure real SMTP and verify delivery. Account email binding is intentionally separate from
   username/password registration; codes are never returned in API responses.
2. Confirm semester start/period mapping; missing values deliberately reject course creation.
3. Review provisional code expiry, retry/rate/token lifetimes and operational limits documented
   in README; do not treat them as approved university/SRS policy.
4. Connect the existing clients and extend shared contracts in a separately authorized task.
   Student transport lacks auth headers; admin has only MockTransport; shared OpenAPI YAML is
   health-only. Existing competition-array/dashboard structures and state enums are preserved.
5. Docker Compose was authored but Docker is unavailable in this execution environment; actual
   database evidence came from native MySQL 8.4.7. Confirm Docker configuration on the target host.
6. Run the deadline worker with the API. Deploy with HTTPS and configured CORS origins. No
   production deployment, real accounts or secrets were created.

Startup, migration, Docker, administrator provisioning and test commands are in [README.md](README.md).
The temporary native MySQL process is shut down after verification; its data and restart script
are retained under the ignored `.tools` directory. No application server is left running.
