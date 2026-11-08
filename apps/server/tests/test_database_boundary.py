import pytest

from app.core.config import get_settings
from app.db.session import get_engine


def test_database_engine_is_not_created_without_explicit_url(monkeypatch) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)
    get_settings.cache_clear()
    get_engine.cache_clear()

    with pytest.raises(RuntimeError, match="DATABASE_URL is not configured"):
        get_engine()

