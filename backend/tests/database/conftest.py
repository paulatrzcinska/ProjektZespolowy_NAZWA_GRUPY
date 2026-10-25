import os
from collections.abc import AsyncIterator
from uuid import uuid4

import pytest
import pytest_asyncio
from alembic import command
from alembic.config import Config
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool
from sqlalchemy.schema import CreateSchema, DropSchema


def alembic_config() -> Config:
    from pathlib import Path

    return Config(str(Path(__file__).resolve().parents[3] / "db" / "alembic.ini"))


@pytest.fixture
def migration_config() -> Config:
    return alembic_config()


@pytest.fixture
def database_test_url() -> str:
    value = os.environ.get("TEST_DATABASE_URL")
    if not value:
        pytest.skip("Set TEST_DATABASE_URL to run PostgreSQL integration tests")
    url = make_url(value)
    if url.drivername != "postgresql+asyncpg" or not (url.database or "").endswith(
        "_test"
    ):
        raise ValueError(
            "TEST_DATABASE_URL must use postgresql+asyncpg and a database ending in _test"
        )
    return value


@pytest_asyncio.fixture
async def database_engine(database_test_url: str) -> AsyncIterator[AsyncEngine]:
    schema = f"test_{uuid4().hex}"
    admin = create_async_engine(
        database_test_url, poolclass=NullPool, hide_parameters=True
    )
    isolated = create_async_engine(
        database_test_url,
        poolclass=NullPool,
        hide_parameters=True,
        connect_args={"server_settings": {"search_path": schema}},
    )
    async with admin.begin() as connection:
        await connection.execute(CreateSchema(schema))
    try:
        async with isolated.begin() as connection:

            def migrate(sync_connection):
                config = alembic_config()
                config.attributes["connection"] = sync_connection
                command.upgrade(config, "head")

            await connection.run_sync(migrate)
        yield isolated
    finally:
        await isolated.dispose()
        async with admin.begin() as connection:
            await connection.execute(DropSchema(schema, cascade=True))
        await admin.dispose()


@pytest_asyncio.fixture
async def db_session(database_engine: AsyncEngine) -> AsyncIterator[AsyncSession]:
    async with AsyncSession(database_engine, expire_on_commit=False) as session:
        yield session
