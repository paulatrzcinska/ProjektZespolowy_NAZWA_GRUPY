from app.api import health


async def test_live_health_with_postgresql(client, database_engine, monkeypatch):
    monkeypatch.setattr(health, "engine", database_engine)
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "UP"
    assert response.json()["database"] == "UP"
