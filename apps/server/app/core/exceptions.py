"""Stable errors compatible with the shared ApiErrorPayload contract."""
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError, OperationalError
from starlette.exceptions import HTTPException


class DomainError(Exception):
    def __init__(self, code: str, message: str, status: int = 409, details: dict | None = None):
        self.code, self.message, self.status, self.details = code, message, status, details
        super().__init__(message)


def install_handlers(app: FastAPI) -> None:
    @app.exception_handler(HTTPException)
    async def http_error(request: Request, exc: HTTPException):
        return JSONResponse({"code": "HTTP_ERROR", "message": str(exc.detail)},
                            status_code=exc.status_code, headers=exc.headers)

    @app.exception_handler(DomainError)
    async def domain_error(request: Request, exc: DomainError):
        body = {"code": exc.code, "message": exc.message}
        if exc.details is not None:
            body["details"] = exc.details
        return JSONResponse(body, status_code=exc.status)

    @app.exception_handler(RequestValidationError)
    async def invalid_input(request: Request, exc: RequestValidationError):
        return JSONResponse({"code": "VALIDATION_ERROR", "message": "Invalid request fields.",
                             "details": {"fields": [".".join(map(str, e["loc"])) for e in exc.errors()]}},
                            status_code=422)

    @app.exception_handler(IntegrityError)
    async def conflict(request: Request, exc: IntegrityError):
        return JSONResponse({"code": "CONFLICT", "message": "A conflicting record already exists or a referenced record changed."}, status_code=409)

    @app.exception_handler(OperationalError)
    async def unavailable(request: Request, exc: OperationalError):
        return JSONResponse({"code": "DATABASE_UNAVAILABLE", "message": "Database unavailable or transaction conflict; retry the operation."}, status_code=503)
