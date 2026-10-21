from pydantic import BaseModel, Field

from app.schemas.user import Token


class SessionTokens(Token):
    access_token: str = Field(description="Signed JWT access token")
    refresh_token: str
    expires_in: int


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=1, max_length=8192)
