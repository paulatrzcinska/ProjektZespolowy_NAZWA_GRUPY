import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker

from app import database
from app.models import User

pytestmark = pytest.mark.database


@pytest.mark.parametrize("fail", [False, True])
async def test_request_session_rolls_back_uncommitted_changes(
    database_engine: AsyncEngine,
    monkeypatch: pytest.MonkeyPatch,
    fail: bool,
) -> None:
    factory = async_sessionmaker(database_engine, expire_on_commit=False)
    monkeypatch.setattr(database, "AsyncSessionLocal", factory)
    dependency = database.get_db()
    session = await anext(dependency)
    session.add(User(email="rollback@example.com", hashed_password="test-hash"))
    await session.flush()
    if fail:
        with pytest.raises(RuntimeError, match="request failed"):
            await dependency.athrow(RuntimeError("request failed"))
    else:
        await dependency.aclose()
    async with factory() as verification:
        assert await verification.scalar(select(func.count()).select_from(User)) == 0
