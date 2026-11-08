# ADR 0001 Session and transaction boundaries

Status: accepted for Phase 1 design

One SQLAlchemy Session is created per API request only when a database-backed dependency is used.
The health endpoint does not create an engine or Session. Importing the application never connects
to MySQL.

Command services must open `with session.begin():` before their first database operation. This
prevents a prior implicit autobegin from conflicting with the explicit transaction. Authentication
for a command must either be token-only before the service call or load the actor inside the same
service transaction.

Repositories can query, lock and flush. They cannot commit or roll back. The application service
owns the full business transaction, including application state, membership changes, moderation
results and in-app notification records.

Network calls, file uploads and email delivery do not run inside database transactions. A later
phase may add an outbox for external side effects.

