import asyncio
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest

from app.api import health
from app.core import telemetry
from app.core.settings import get_runtime_settings


def live_health(client):
    client.app.dependency_overrides[get_runtime_settings] = lambda: SimpleNamespace(api_mode="live")


def test_live_health_checks_database_and_keeps_version(client, monkeypatch):
    live_health(client)
    probe = AsyncMock()
    monkeypatch.setattr(health, "probe_database", probe)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "UP", "database": "UP", "version": "dev"}
    assert response.headers["cache-control"] == "no-store"
    probe.assert_awaited_once()


def test_health_database_failure_is_500_without_secrets(client, monkeypatch):
    live_health(client)
    monkeypatch.setattr(health, "probe_database", AsyncMock(side_effect=RuntimeError("private-password")))
    response = client.get("/health")
    assert response.status_code == 500
    assert response.json() == {"status": "DOWN", "database": "DOWN", "version": "dev"}
    assert response.headers["cache-control"] == "no-store"
    assert "private-password" not in response.text


def test_health_times_out_and_cancels_stalled_probe(client, monkeypatch):
    live_health(client)
    cancelled = []

    async def stalled():
        try:
            await asyncio.sleep(30)
        finally:
            cancelled.append(True)

    monkeypatch.setattr(health, "probe_database", stalled)
    response = client.get("/health")
    assert response.status_code == 500
    assert cancelled == [True]


def test_contract_health_explicitly_skips_database(client, monkeypatch):
    probe = AsyncMock()
    monkeypatch.setattr(health, "probe_database", probe)
    assert client.get("/health").json()["database"] == "SKIPPED"
    probe.assert_not_awaited()


async def test_database_probe_executes_query_and_releases_connection(monkeypatch):
    connection = AsyncMock()
    context = AsyncMock()
    context.__aenter__.return_value = connection
    monkeypatch.setattr(health, "engine", SimpleNamespace(connect=Mock(return_value=context)))
    await health.probe_database()
    assert str(connection.execute.await_args.args[0]) == "SELECT 1"
    context.__aexit__.assert_awaited_once()


@pytest.mark.parametrize("path,code,route", [
    ("/health", 200, "/health"),
    ("/api/v1/products", 401, "/products"),
    ("/not-found-private-id", 404, "unmatched"),
    ("/broken", 500, "/broken"),
])
def test_telemetry_records_response_without_request_secrets(client, monkeypatch, path, code, route):
    async def broken():
        raise RuntimeError("test failure")

    client.app.add_api_route("/broken", broken)
    log = Mock()
    monkeypatch.setattr(telemetry.logger, "info", log)
    response = client.get(path + "?token=private-query", headers={"Authorization": "Bearer private-token"})
    assert response.status_code == code
    log.assert_called_once()
    event = json.loads(log.call_args.args[0])
    assert event["event"] == "http_request"
    assert event["status_code"] == code
    assert event["status_class"] == f"{code // 100}xx"
    assert event["route"] == route
    assert event["api_request"] == int(path.startswith("/api/v1/"))
    assert event["duration_ms"] >= 0
    assert "private-" not in log.call_args.args[0]


def test_telemetry_uses_route_template_not_identifier(client, monkeypatch):
    async def sample(item_id: str):
        return {"ok": True}

    client.app.add_api_route("/sample/{item_id}", sample)
    log = Mock()
    monkeypatch.setattr(telemetry.logger, "info", log)
    assert client.get("/sample/private-id").status_code == 200
    assert json.loads(log.call_args.args[0])["route"] == "/sample/{item_id}"
