from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import create_app


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    monkeypatch.setenv("APP_NAME", "test-api")
    monkeypatch.setenv("DEBUG", "false")
    monkeypatch.setenv("API_V1_PREFIX", "/api/v1")
    monkeypatch.setenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:8081")
    get_settings.cache_clear()
    try:
        with TestClient(create_app()) as test_client:
            yield test_client
    finally:
        get_settings.cache_clear()
