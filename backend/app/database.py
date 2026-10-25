import ssl
from collections.abc import AsyncGenerator
from typing import Any

from sqlalchemy import MetaData
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import Settings, get_settings

NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


def database_connect_args(settings: Settings) -> dict[str, Any]:
    if settings.database_ssl_ca is None:
        return {}
    return {"ssl": ssl.create_default_context(cafile=str(settings.database_ssl_ca))}


settings = get_settings()
engine = create_async_engine(
    settings.database_url(),
    pool_pre_ping=True,
    echo=settings.debug,
    hide_parameters=True,
    connect_args=database_connect_args(settings),
)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
