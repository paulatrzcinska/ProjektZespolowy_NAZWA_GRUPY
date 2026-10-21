import os
from pathlib import Path
from uuid import uuid4

import httpx2
import pytest
import pytest_asyncio
from alembic import command
from alembic.config import Config
from sqlalchemy import select
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool
from sqlalchemy.schema import CreateSchema, DropSchema

from app.core.security import hash_password
from app.core.settings import get_runtime_settings
from app.database import get_db
from app.main import create_app
from app.models.user import User

PASSWORD = "Password123!"


@pytest_asyncio.fixture
async def database_engine():
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("Set TEST_DATABASE_URL for persistent API integration tests")
    parsed = make_url(url)
    if parsed.drivername != "postgresql+asyncpg" or not (
        parsed.database or ""
    ).endswith("_test"):
        raise ValueError("Use a separate PostgreSQL database ending in _test")
    schema = f"runtime_{uuid4().hex}"
    admin = create_async_engine(url, poolclass=NullPool)
    engine = create_async_engine(
        url,
        poolclass=NullPool,
        connect_args={"server_settings": {"search_path": schema}},
        hide_parameters=True,
    )
    async with admin.begin() as connection:
        await connection.execute(CreateSchema(schema))
    try:
        async with engine.begin() as connection:

            def migrate(sync_connection):
                config = Config(
                    str(Path(__file__).resolve().parents[3] / "db/alembic.ini")
                )
                config.attributes["connection"] = sync_connection
                command.upgrade(config, "head")

            await connection.run_sync(migrate)
        yield engine
    finally:
        await engine.dispose()
        async with admin.begin() as connection:
            await connection.execute(DropSchema(schema, cascade=True))
        await admin.dispose()


@pytest_asyncio.fixture
async def db(database_engine):
    async with AsyncSession(database_engine, expire_on_commit=False) as session:
        yield session


@pytest_asyncio.fixture
async def client(database_engine, monkeypatch):
    monkeypatch.setenv("API_MODE", "live")
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("JWT_SECRET", "test-only-secret-" * 4)
    monkeypatch.setenv("PAYMENTS_MOCK", "true")
    monkeypatch.setenv("AUTH_RATE_LIMIT", "1000")
    monkeypatch.setenv("CREATE_DEFAULT_ADMIN", "false")
    get_runtime_settings.cache_clear()
    application = create_app()
    factory = async_sessionmaker(
        database_engine, expire_on_commit=False, autoflush=False
    )

    async def session_dependency():
        async with factory() as session:
            yield session

    application.dependency_overrides[get_db] = session_dependency
    try:
        async with httpx2.AsyncClient(
            transport=httpx2.ASGITransport(app=application), base_url="http://test"
        ) as instance:
            instance.application = application
            yield instance
    finally:
        get_runtime_settings.cache_clear()


async def register(client, email="customer@example.com", **extra):
    response = await client.post(
        "/api/v1/auth/register", json={"email": email, "password": PASSWORD, **extra}
    )
    assert response.status_code == 201, response.text
    login = await client.post(
        "/api/v1/auth/login", json={"email": email, "password": PASSWORD}
    )
    assert login.status_code == 200, login.text
    return {
        "user": response.json(),
        "tokens": login.json(),
        "headers": {"Authorization": "Bearer " + login.json()["access_token"]},
    }


@pytest_asyncio.fixture
async def customer(client):
    return await register(client)


@pytest_asyncio.fixture
async def other_customer(client):
    return await register(client, "other@example.com")


@pytest_asyncio.fixture
async def admin(client, db):
    db.add(
        User(
            email="admin@example.com",
            hashed_password=hash_password(PASSWORD),
            is_admin=True,
            is_active=True,
        )
    )
    await db.commit()
    result = await client.post(
        "/api/v1/auth/login", json={"email": "admin@example.com", "password": PASSWORD}
    )
    assert result.status_code == 200, result.text
    user_id = await db.scalar(select(User.id).where(User.email == "admin@example.com"))
    return {
        "id": user_id,
        "headers": {"Authorization": "Bearer " + result.json()["access_token"]},
    }


@pytest_asyncio.fixture
async def product(client, admin):
    category = await client.post(
        "/api/v1/categories",
        headers=admin["headers"],
        json={"name": "Chairs", "slug": "chairs"},
    )
    assert category.status_code == 201, category.text
    response = await client.post(
        "/api/v1/products",
        headers=admin["headers"],
        json={
            "name": "Oak chair",
            "slug": "oak-chair",
            "price": "199.99",
            "stock_quantity": 10,
            "category_id": category.json()["id"],
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


SHIPPING = {
    "shipping_full_name": "Jan Kowalski",
    "shipping_address_line1": "Dluga 1",
    "shipping_city": "Warszawa",
    "shipping_postal_code": "00-001",
    "shipping_country": "Polska",
}


async def checkout(client, account, product_id, quantity=2, key=None):
    added = await client.post(
        "/api/v1/cart/items",
        headers=account["headers"],
        json={"product_id": product_id, "quantity": quantity},
    )
    assert added.status_code == 201, added.text
    headers = {**account["headers"]}
    if key:
        headers["Idempotency-Key"] = str(key)
    return await client.post("/api/v1/orders", headers=headers, json=SHIPPING)
