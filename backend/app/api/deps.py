from typing import Annotated

from fastapi import Depends, HTTPException, Path
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_token, matches_password_stamp
from app.core.settings import get_runtime_settings
from app.database import get_db
from app.models.user import User

bearer = HTTPBearer(
    scheme_name="BearerAuth",
    bearerFormat="JWT",
    auto_error=False,
    description="JWT access token returned by POST /auth/login",
)
DbSession = Annotated[AsyncSession, Depends(get_db)]
ResourceId = Annotated[int, Path(ge=1)]


def unauthorized() -> HTTPException:
    return HTTPException(
        401, "Not authenticated", headers={"WWW-Authenticate": "Bearer"}
    )


async def get_current_user_optional(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    db: DbSession,
) -> User | None:
    if credentials is None:
        return None
    settings = get_runtime_settings()
    claims = decode_token(credentials.credentials, settings)
    if claims is None:
        raise unauthorized()
    user = await db.get(User, int(claims["sub"]))
    if (
        user is None
        or not user.is_active
        or not matches_password_stamp(user, claims, settings)
    ):
        raise unauthorized()
    return user


async def get_current_user(
    user: Annotated[User | None, Depends(get_current_user_optional)],
) -> User:
    if user is None:
        raise unauthorized()
    return user


async def get_current_admin(user: Annotated[User, Depends(get_current_user)]) -> User:
    if not user.is_admin:
        raise HTTPException(403, "Admin only")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
OptionalUser = Annotated[User | None, Depends(get_current_user_optional)]
AdminUser = Annotated[User, Depends(get_current_admin)]
