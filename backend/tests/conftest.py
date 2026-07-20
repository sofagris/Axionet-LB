from collections.abc import Generator
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401 — register metadata
from app.api.v1 import system as system_routes
from app.core.security import enforce_auth, hash_password
from app.db.base import Base
from app.db.session import get_db
from app.main import create_app
from app.models.user import User
from app.services.docker.client import DockerClientAdapter


@pytest.fixture()
def db_session() -> Generator[Session, None, None]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def docker_adapter() -> MagicMock:
    adapter = MagicMock(spec=DockerClientAdapter)
    adapter.ping.return_value = None
    return adapter


@pytest.fixture()
def client(db_session: Session, docker_adapter: MagicMock) -> Generator[TestClient, None, None]:
    """Authenticated API client (auth guard bypassed for existing suite)."""
    app = create_app(enable_lifespan=False)

    def _override_db() -> Generator[Session, None, None]:
        yield db_session

    def _override_docker() -> MagicMock:
        return docker_adapter

    app.dependency_overrides[get_db] = _override_db
    app.dependency_overrides[system_routes.get_docker_adapter] = _override_docker
    app.dependency_overrides[enforce_auth] = lambda: None

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


@pytest.fixture()
def auth_client(db_session: Session, docker_adapter: MagicMock) -> Generator[TestClient, None, None]:
    """Client with real auth enforcement and a seeded Admin user."""
    app = create_app(enable_lifespan=False)

    def _override_db() -> Generator[Session, None, None]:
        yield db_session

    def _override_docker() -> MagicMock:
        return docker_adapter

    admin = User(
        username="Admin",
        password_hash=hash_password("Password"),
        role="admin",
        is_active=True,
    )
    db_session.add(admin)
    db_session.commit()

    app.dependency_overrides[get_db] = _override_db
    app.dependency_overrides[system_routes.get_docker_adapter] = _override_docker

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()
