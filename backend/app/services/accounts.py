from fastapi import HTTPException
from pydantic import EmailStr, TypeAdapter
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.api.deps import unauthorized
from app.core.security import (
    create_token,
    decode_token,
    dummy_password_hash,
    hash_password,
    matches_password_stamp,
    verify_password,
)
from app.core.settings import RuntimeSettings
from app.models.user import User
from app.schemas.session import SessionTokens
from app.schemas.user import UserCreate, UserProfileUpdate, UserRead
from app.services.transactions import commit


def normalize_email(email: str) -> str:
    return str(TypeAdapter(EmailStr).validate_python(email)).casefold()


async def register_user(db: AsyncSession, body: UserCreate) -> UserRead:
    email = normalize_email(str(body.email))
    if await db.scalar(select(User.id).where(User.email == email)):
        raise HTTPException(409, "Email already registered")
    user = User(
        email=email,
        hashed_password=await run_in_threadpool(hash_password, body.password),
        full_name=body.full_name.strip() or None if body.full_name else None,
        is_admin=False,
        is_active=True,
    )
    db.add(user)
    await commit(db, "Email already registered")
    await db.refresh(user)
    return UserRead.model_validate(user)


def issue_tokens(user: User, settings: RuntimeSettings) -> SessionTokens:
    return SessionTokens(
        access_token=create_token(user, settings, "access"),
        refresh_token=create_token(user, settings, "refresh"),
        expires_in=settings.access_token_minutes * 60,
    )


async def authenticate(
    db: AsyncSession, email: str, password: str, settings: RuntimeSettings
) -> SessionTokens:
    user = await db.scalar(select(User).where(User.email == normalize_email(email)))
    encoded = (
        user.hashed_password if user else await run_in_threadpool(dummy_password_hash)
    )
    valid = await run_in_threadpool(verify_password, password, encoded)
    if user is None or not valid:
        raise HTTPException(
            401, "Invalid credentials", headers={"WWW-Authenticate": "Bearer"}
        )
    if not user.is_active:
        raise HTTPException(403, "Inactive user")
    return issue_tokens(user, settings)


async def refresh_tokens(
    db: AsyncSession, token: str, settings: RuntimeSettings
) -> SessionTokens:
    claims = decode_token(token, settings, "refresh")
    if claims is None:
        raise unauthorized()
    user = await db.get(User, int(claims["sub"]))
    if (
        user is None
        or not user.is_active
        or not matches_password_stamp(user, claims, settings)
    ):
        raise unauthorized()
    return issue_tokens(user, settings)


async def update_profile(
    db: AsyncSession, user: User, body: UserProfileUpdate
) -> UserRead:
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(user, key, value.strip() or None if isinstance(value, str) else value)
    await commit(db)
    await db.refresh(user)
    return UserRead.model_validate(user)


async def change_password(db: AsyncSession, user: User, current: str, new: str) -> None:
    if not await run_in_threadpool(verify_password, current, user.hashed_password):
        raise HTTPException(
            401, "Invalid current password", headers={"WWW-Authenticate": "Bearer"}
        )
    user.hashed_password = await run_in_threadpool(hash_password, new)
    await commit(db)


async def ensure_admin(db: AsyncSession, email: str, password: str) -> bool:
    if len(password) < 8 or len(password) > 128:
        raise ValueError("Admin password must have 8–128 characters")
    email = normalize_email(email)
    existing = await db.scalar(select(User).where(User.email == email))
    if existing:
        if not existing.is_admin or not existing.is_active:
            raise ValueError(
                "An existing customer or inactive account cannot be bootstrapped as administrator"
            )
        return False
    db.add(
        User(
            email=email,
            hashed_password=await run_in_threadpool(hash_password, password),
            full_name="Administrator",
            is_admin=True,
            is_active=True,
        )
    )
    await commit(db, "An account with this email already exists")
    return True
