import pytest
from alembic.config import Config
from sqlalchemy import inspect, text
from sqlalchemy.ext.asyncio import AsyncEngine

from alembic import command
from app.database import Base

pytestmark = pytest.mark.database


async def test_migrations_match_models_and_can_be_reapplied(
    database_engine: AsyncEngine,
    migration_config: Config,
) -> None:
    async with database_engine.begin() as connection:

        def verify(sync_connection):
            config = migration_config
            config.attributes["connection"] = sync_connection
            assert set(inspect(sync_connection).get_table_names()) == set(
                Base.metadata.tables
            ) | {"alembic_version"}
            command.check(config)
            command.upgrade(config, "head")
            command.downgrade(config, "base")
            assert inspect(sync_connection).get_table_names() == ["alembic_version"]
            assert (
                sync_connection.execute(
                    text(
                        "SELECT typname FROM pg_type JOIN pg_namespace ON pg_namespace.oid = pg_type.typnamespace "
                        "WHERE pg_namespace.nspname = current_schema() AND typtype = 'e'"
                    )
                ).all()
                == []
            )
            command.upgrade(config, "head")
            command.check(config)

        await connection.run_sync(verify)
