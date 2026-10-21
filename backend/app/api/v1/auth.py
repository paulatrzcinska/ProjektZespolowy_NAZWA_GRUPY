from fastapi import APIRouter, Depends, Response

from app.api.deps import CurrentUser, DbSession
from app.api.responses import error_responses
from app.core.limiter import limit_auth
from app.core.settings import get_runtime_settings
from app.schemas.session import RefreshRequest, SessionTokens
from app.schemas.user import (
    LoginRequest,
    PasswordChangeRequest,
    UserCreate,
    UserProfileUpdate,
    UserRead,
)
from app.services import accounts

router = APIRouter(prefix="/auth", tags=["auth"])
auth_limits = [Depends(limit_auth)]


@router.post(
    "/register",
    response_model=UserRead,
    status_code=201,
    responses=error_responses(409, 429),
    dependencies=auth_limits,
)
async def register(body: UserCreate, db: DbSession) -> UserRead:
    return await accounts.register_user(db, body)


@router.post(
    "/login",
    response_model=SessionTokens,
    responses=error_responses(401, 403, 429),
    dependencies=auth_limits,
)
async def login(body: LoginRequest, db: DbSession) -> SessionTokens:
    return await accounts.authenticate(
        db, str(body.email), body.password, get_runtime_settings()
    )


@router.post(
    "/refresh",
    response_model=SessionTokens,
    responses=error_responses(401, 429),
    dependencies=auth_limits,
)
async def refresh(body: RefreshRequest, db: DbSession) -> SessionTokens:
    return await accounts.refresh_tokens(db, body.refresh_token, get_runtime_settings())


@router.get("/me", response_model=UserRead, responses=error_responses(401))
async def read_me(current: CurrentUser) -> UserRead:
    return UserRead.model_validate(current)


@router.patch("/me", response_model=UserRead, responses=error_responses(401))
async def update_me(
    body: UserProfileUpdate, current: CurrentUser, db: DbSession
) -> UserRead:
    return await accounts.update_profile(db, current, body)


@router.post(
    "/change-password",
    status_code=204,
    responses=error_responses(401, 429),
    dependencies=auth_limits,
)
async def change_password(
    body: PasswordChangeRequest, current: CurrentUser, db: DbSession
) -> Response:
    await accounts.change_password(
        db, current, body.current_password, body.new_password
    )
    return Response(status_code=204)
