# ADR 0002 MySQL conditional uniqueness design todo

Status: proposed; implementation and migration deferred

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

