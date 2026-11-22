from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.exceptions import install_handlers


def create_app() -> FastAPI:
    settings = get_settings()
    application = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        docs_url=f"{settings.api_prefix}/docs" if settings.enable_docs else None,
        openapi_url=f"{settings.api_prefix}/openapi.json" if settings.enable_docs else None,
    )
    application.include_router(api_router, prefix=settings.api_prefix)
    install_handlers(application)
    if settings.cors_origins:
        application.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins,
                                   allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
                                   allow_headers=["Authorization", "Content-Type"])
    return application


app = create_app()

