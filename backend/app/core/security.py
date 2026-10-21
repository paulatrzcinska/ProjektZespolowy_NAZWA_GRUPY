import hashlib
import hmac
import secrets
from datetime import UTC, datetime, timedelta
from functools import lru_cache
from typing import Literal
from uuid import uuid4

import jwt
from pwdlib import PasswordHash
from pwdlib.exceptions import UnknownHashError

from app.core.settings import RuntimeSettings
from app.models.user import User

_password_hash = PasswordHash.recommended()


def hash_password(password: str) -> str:
    return _password_hash.hash(password)


def verify_password(password: str, encoded: str) -> bool:
    try:
        return _password_hash.verify(password, encoded)
    except (ValueError, TypeError, UnknownHashError):
        return False


@lru_cache
def dummy_password_hash() -> str:
    return hash_password(secrets.token_urlsafe(32))


def password_stamp(user: User, settings: RuntimeSettings) -> str:
    return hmac.new(
        settings.jwt_secret.get_secret_value().encode(),
        user.hashed_password.encode(),
        hashlib.sha256,
    ).hexdigest()


def create_token(
    user: User,
    settings: RuntimeSettings,
    kind: Literal["access", "refresh"],
    *,
    now: datetime | None = None,
) -> str:
    now = now or datetime.now(UTC)
    duration = (
        timedelta(minutes=settings.access_token_minutes)
        if kind == "access"
        else timedelta(days=settings.refresh_token_days)
    )
    return jwt.encode(
        {
            "sub": str(user.id),
            "type": kind,
            "iat": now,
            "nbf": now,
            "exp": now + duration,
            "iss": settings.jwt_issuer,
            "aud": settings.jwt_audience,
            "jti": str(uuid4()),
            "pwd": password_stamp(user, settings),
        },
        settings.jwt_secret.get_secret_value(),
        algorithm="HS256",
    )


def decode_token(
    token: str, settings: RuntimeSettings, kind: Literal["access", "refresh"] = "access"
) -> dict | None:
    try:
        claims = jwt.decode(
            token,
            settings.jwt_secret.get_secret_value(),
            algorithms=["HS256"],
            issuer=settings.jwt_issuer,
            audience=settings.jwt_audience,
            options={
                "require": [
                    "sub",
                    "type",
                    "iat",
                    "nbf",
                    "exp",
                    "iss",
                    "aud",
                    "jti",
                    "pwd",
                ]
            },
        )
        if (
            claims["type"] != kind
            or not isinstance(claims["sub"], str)
            or not claims["sub"].isdigit()
            or int(claims["sub"]) < 1
        ):
            return None
        if not isinstance(claims["pwd"], str):
            return None
        return claims
    except (jwt.InvalidTokenError, ValueError, TypeError):
        return None


def matches_password_stamp(user: User, claims: dict, settings: RuntimeSettings) -> bool:
    return hmac.compare_digest(password_stamp(user, settings), claims["pwd"])
