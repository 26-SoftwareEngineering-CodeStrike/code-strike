from collections.abc import Iterator
from functools import lru_cache

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings


@lru_cache
def get_engine() -> Engine:
    database_url = get_settings().database_url
    if not database_url:
        raise RuntimeError("DATABASE_URL is not configured; Phase 1 health checks do not require it.")
    return create_engine(database_url, pool_pre_ping=True)


@lru_cache
def get_session_factory() -> sessionmaker[Session]:
    return sessionmaker(bind=get_engine(), autoflush=False, expire_on_commit=False)


def get_session() -> Iterator[Session]:
    """Provide one request-scoped Session without committing implicitly.

    Command services must enter ``with session.begin():`` before their first database
    operation. Repositories may flush when needed but never commit or roll back.
    Query services may read and let request teardown close the implicit read transaction.
    """
    with get_session_factory() as session:
        yield session

