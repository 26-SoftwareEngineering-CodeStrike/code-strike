# Business module convention

Future modules are organized by business capability rather than technical tables:

```text
module_name/
├── router.py
├── schemas.py
├── service.py
├── repository.py
├── models.py
├── policies.py
└── errors.py
```

Routers translate HTTP input and output. Services own use cases, authorization and transaction
boundaries. Repositories own persistence queries and row locking but never commit or roll back.
Schemas are Pydantic API models and are not SQLAlchemy entities.

