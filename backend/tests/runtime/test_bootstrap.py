import pytest
from sqlalchemy import func, select

from app.models.user import User
from app.services.accounts import ensure_admin

from .conftest import PASSWORD

pytestmark = pytest.mark.database


async def test_admin_bootstrap_is_idempotent_and_does_not_reset_password(db):
    assert await ensure_admin(db, "admin@example.com", PASSWORD) is True
    user = await db.scalar(select(User).where(User.email == "admin@example.com"))
    encoded = user.hashed_password
    assert user.is_admin and user.is_active
    assert await ensure_admin(db, "admin@example.com", "DifferentPassword123") is False
    assert user.hashed_password == encoded
    assert await db.scalar(select(func.count()).select_from(User)) == 1


async def test_bootstrap_never_promotes_an_existing_customer(client, customer, db):
    with pytest.raises(ValueError, match="customer"):
        await ensure_admin(db, customer["user"]["email"], PASSWORD)
    user = await db.get(User, customer["user"]["id"])
    assert user.is_admin is False
