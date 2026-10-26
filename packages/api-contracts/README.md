# Shared API contracts

This package contains transport-neutral TypeScript contracts and fictional Phase 1 fixtures. The
formal REST namespace is `/api/v1`. The OpenAPI file currently describes only the implemented
health endpoint; future business endpoints must be added only when their schemas and behavior are
approved.

Production DTOs are exported from `@codestrike/contracts`. Mock fixtures are deliberately separated
behind `@codestrike/contracts/mock`. Applications select `MockTransport` or a platform-compatible
HTTP transport without changing feature code.

