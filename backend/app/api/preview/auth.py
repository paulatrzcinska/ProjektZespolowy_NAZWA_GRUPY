from fastapi import APIRouter, Response, status

from app.api.preview.deps import CurrentUser
from app.api.responses import error_responses
from app.schemas.user import (
    LoginRequest,
    PasswordChangeRequest,
    Token,
    UserCreate,
    UserProfileUpdate,
    UserRead,
)
from app.services.contract_examples import USER_TOKEN

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
    responses=error_responses(409),
    summary="Register a user",
)
async def register(body: UserCreate) -> UserRead:
    return UserRead(id=3, email=body.email, full_name=body.full_name, is_admin=False)


@router.post(
    "/login",
    response_model=Token,
    responses=error_responses(401, 403),
    summary="Log in with email and password",
    description="Returns an example user token. The preview does not verify passwords.",
)
async def login(body: LoginRequest) -> Token:
    return Token(access_token=USER_TOKEN)


@router.get(
    "/me",
    response_model=UserRead,
    responses=error_responses(401),
    summary="Read the current user",
)
async def read_me(current: CurrentUser) -> UserRead:
    return current


@router.patch(
    "/me",
    response_model=UserRead,
    responses=error_responses(401),
    summary="Update the current user's profile",
)
async def update_me(body: UserProfileUpdate, current: CurrentUser) -> UserRead:
    return current.model_copy(update=body.model_dump(exclude_unset=True))


@router.post(
    "/change-password",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=error_responses(401),
    summary="Change the current user's password",
)
async def change_password(
    body: PasswordChangeRequest, current: CurrentUser
) -> Response:
    return Response(status_code=status.HTTP_204_NO_CONTENT)
