"""Exercise production dependencies as well as the overridden API fixtures."""
from types import SimpleNamespace
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient
from app.core.config import get_settings
from app.main import create_app


def test_session_dependency_opens_and_closes_session(db_session_factory, monkeypatch):
    import app.db.session as wiring
    monkeypatch.setattr(wiring, 'get_settings', lambda: SimpleNamespace(database_url='test-configured'))
    monkeypatch.setattr(wiring, 'get_session_factory', lambda: db_session_factory)
    iterator = wiring.get_session()
    session = next(iterator)
    assert isinstance(session, Session)
    iterator.close()
    assert not session.in_transaction()


def test_unconfigured_database_keeps_health_working(monkeypatch):
    monkeypatch.delenv('DATABASE_URL', raising=False)
    get_settings.cache_clear()
    try:
        with TestClient(create_app()) as client:
            assert client.get('/api/v1/health').status_code == 200
            response = client.get('/api/v1/competitions')
            assert response.status_code == 503
            assert response.json()['code'] == 'DATABASE_UNAVAILABLE'
    finally:
        get_settings.cache_clear()
