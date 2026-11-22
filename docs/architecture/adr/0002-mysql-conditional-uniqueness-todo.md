# ADR 0002 MySQL conditional uniqueness design todo

Status: accepted after actual MySQL 8.4.7 validation (2026-11-08)

## Verified implementation decision

Use stored generated nullable integer guards on historical relation tables:

- `memberships.active_guard = CASE WHEN status = 'Active' THEN 1 ELSE NULL END`,
  with unique `(student_id, competition_id, active_guard)`;
- `applications.pending_guard = CASE WHEN status = 'Pending' THEN 1 ELSE NULL END`,
  with unique `(applicant_id, team_id, pending_guard)`.

Membership episodes remain separate from application decisions. Ending a membership clears
its generated guard but retains the historical row; terminal applications likewise retain
their records. Composite foreign keys also prevent a relation from naming a team in a different
competition. The alternative current-relation table is valid, but would add a second write and
another consistency boundary for each membership episode without improving this project's queries.

All admission and membership changes lock the competition row before the team and application
rows. This intentionally serializes writes within a competition; different competitions remain
independent. Capacity includes the captain. SQLAlchemy's MySQL engine uses READ COMMITTED:
subsequent reads see the latest committed state after waiting for the competition lock, rather
than reusing the snapshot established by initial authentication under REPEATABLE READ.
Services own explicit transactions. Uniqueness violations return 409; transaction/database
availability failures return 503 without exposing SQL or credentials.

Evidence: `apps/server/tests/test_mysql_integrity.py`, executed against native MySQL 8.4.7
InnoDB/utf8mb4 on Windows with Python 3.13.9, passed all five tests. The tests verify duplicate
current memberships and Pending applications fail at the database, repeated terminal rows with
NULL guards succeed, stored generated columns exist in SHOW CREATE TABLE, last-slot approval
races, same-applicant cross-team approval, duplicate submissions, concurrent team creation,
and withdrawal versus approval. The complete API suite is also runnable against migrated,
isolated MySQL databases via TEST_MYSQL_URL. SQLite results are not evidence for these claims.

Migration: `apps/server/alembic/versions/0001_initial_mandatory_backend_schema.py`.

## Original Phase 1 design record

MySQL 8.4 remains the target. Phase 1 does not connect to or modify any database. PostgreSQL partial
unique-index syntax must not be used.

The Phase 2 schema spike must validate one of these MySQL-compatible strategies:

1. Stored generated guard columns that return a stable value for the active or Pending state and
   `NULL` for historical rows, followed by composite unique indexes. MySQL permits multiple `NULL`
   values in a unique index.
2. Separate current-relation tables with primary keys such as `(student_id, competition_id)`, while
   historical membership and application decisions remain append-only records.

Required invariants:

- one current membership per student and competition;
- one Pending application per student and team, while terminal historical applications remain;
- capacity includes the captain;
- concurrent approvals cannot exceed capacity or create memberships in two teams for one competition.

Capacity is not expressible as a single row constraint. Approval must combine database uniqueness,
`SELECT ... FOR UPDATE` on the application and team, current membership revalidation, an active
member count, one atomic transaction and conflict-safe error handling. The final choice requires a
MySQL 8.4 integration test before an Alembic migration is approved.

