"""Isolated SQLite API tests; separate MySQL tests verify engine-specific invariants."""
from datetime import timedelta
from uuid import uuid4
import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db import models  # noqa: F401
from app.db.session import get_session
from app.core.security import hash_password, token_digest
from app.modules.auth.models import AuthToken, User, utcnow
from app.main import create_app


@pytest.fixture
def db_session_factory():
    mysql_url = os.getenv("TEST_MYSQL_URL")
    if mysql_url:
        # Dedicated randomly named test database; never touch application/user databases.
        from alembic.config import Config
        from alembic import command
        from app.core.config import get_settings
        from pathlib import Path
        database = "codestrike_it_" + uuid4().hex
        root_url = make_url(mysql_url)
        control = create_engine(root_url.set(database=None))
        with control.begin() as conn:
            version = conn.scalar(text("SELECT VERSION()"))
            assert version.startswith("8.4."), f"Expected MySQL 8.4, got {version}"
            conn.execute(text(f"CREATE DATABASE `{database}` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci"))
        url = root_url.set(database=database).render_as_string(hide_password=False)
        previous = os.environ.get("DATABASE_URL")
        os.environ["DATABASE_URL"] = url
        get_settings.cache_clear()
        config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
        try:
            command.upgrade(config, "head")
            engine = create_engine(url, isolation_level="READ COMMITTED", pool_size=25, max_overflow=5)
            factory = sessionmaker(engine, autoflush=False, expire_on_commit=False)
            yield factory
            engine.dispose()
        finally:
            if previous is None:
                os.environ.pop("DATABASE_URL", None)
            else:
                os.environ["DATABASE_URL"] = previous
            get_settings.cache_clear()
            # Exact name was generated and created in this fixture; no shared schema cleanup.
            with control.begin() as conn:
                conn.execute(text(f"DROP DATABASE `{database}`"))
            control.dispose()
        return
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    @event.listens_for(engine, "connect")
    def enable_fks(connection, record):
        connection.execute("PRAGMA foreign_keys=ON")
    Base.metadata.create_all(engine)  # Test-only schema, production exclusively Alembic.
    factory = sessionmaker(engine, autoflush=False, expire_on_commit=False)
    yield factory
    engine.dispose()


@pytest.fixture
def client(db_session_factory):
    application = create_app()
    def session_override():
        with db_session_factory() as session:
            yield session
    application.dependency_overrides[get_session] = session_override
    with TestClient(application) as api:
        yield api


@pytest.fixture(scope="session")
def fixture_password_hash():
    return hash_password("Test-password-123!")


@pytest.fixture
def make_user(db_session_factory, fixture_password_hash):
    def create(role="Student", complete=False):
        from app.modules.profiles.models import Profile, ProfileSkill
        from app.modules.skills.models import Skill
        raw = str(uuid4()) + str(uuid4())
        with db_session_factory.begin() as session:
            u = User(username="test_" + uuid4().hex[:16], role=role, password_hash=fixture_password_hash)
            session.add(u)
            session.flush()
            session.add(AuthToken(digest=token_digest(raw), user_id=u.id, expires_at=utcnow()+timedelta(days=1)))
            if complete:
                skill = Skill(name="Skill_" + uuid4().hex[:12])
                session.add(skill)
                session.flush()
                session.add(Profile(user_id=u.id, name="Test Student", college="Engineering", major="CS",
                                    academic_year="2", sex="Unspecified", brief_cv="Test CV", wechat_id="private-contact"))
                session.flush()
                session.add(ProfileSkill(user_id=u.id, skill_id=skill.id))
            return u.id, {"Authorization": "Bearer " + raw}
    return create


@pytest.fixture
def student_headers(make_user):
    return make_user()[1]


@pytest.fixture
def other_headers(make_user):
    return make_user()[1]


@pytest.fixture
def admin_headers(make_user):
    return make_user(role="Admin")[1]
