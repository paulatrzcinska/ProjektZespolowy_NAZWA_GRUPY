from typing import Annotated

from fastapi import Depends, HTTPException, Path
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.schemas.user import UserRead
from app.services.contract_examples import ADMIN_TOKEN, USER_TOKEN, example_user

bearer = HTTPBearer(
    scheme_name="BearerAuth",
    description=(
        "Contract preview: use example-user-token or example-admin-token. "
        "These are example credentials, not real authentication."
    ),
    auto_error=False,
)


def get_current_user_optional(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> UserRead | None:
    if credentials is None:
        return None
    if credentials.credentials == ADMIN_TOKEN:
        return example_user(admin=True)
    if credentials.credentials == USER_TOKEN:
        return example_user()
    raise HTTPException(401, "Invalid token", headers={"WWW-Authenticate": "Bearer"})


def get_current_user(
    user: Annotated[UserRead | None, Depends(get_current_user_optional)],
) -> UserRead:
    if user is None:
        raise HTTPException(401, "Not authenticated", headers={"WWW-Authenticate": "Bearer"})
    return user


def get_current_admin(user: Annotated[UserRead, Depends(get_current_user)]) -> UserRead:
    if not user.is_admin:
        raise HTTPException(403, "Admin only")
    return user


ResourceId = Annotated[int, Path(ge=1)]
CurrentUser = Annotated[UserRead, Depends(get_current_user)]
OptionalUser = Annotated[UserRead | None, Depends(get_current_user_optional)]
AdminUser = Annotated[UserRead, Depends(get_current_admin)]
