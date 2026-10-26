from fastapi.testclient import TestClient

from app.main import app


def test_health_endpoint_without_database_configuration(monkeypatch) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)

    response = TestClient(app).get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "CodeStrike API",
        "api_version": "v1",
    }

