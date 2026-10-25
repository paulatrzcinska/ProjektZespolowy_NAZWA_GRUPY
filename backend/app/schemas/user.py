from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr = Field(examples=["user@example.com"])
    password: str = Field(min_length=8, max_length=128, examples=["example-password"])
    full_name: str | None = Field(default=None, max_length=200, examples=["Jan Kowalski"])


class UserProfileUpdate(BaseModel):
    full_name: str | None = Field(default=None, max_length=200)
    shipping_full_name: str | None = Field(default=None, max_length=200)
    shipping_address_line1: str | None = Field(default=None, max_length=300)
    shipping_address_line2: str | None = Field(default=None, max_length=300)
    shipping_city: str | None = Field(default=None, max_length=120)
    shipping_postal_code: str | None = Field(default=None, max_length=32)
    shipping_country: str | None = Field(default=None, max_length=120)


class UserRead(UserProfileUpdate):
    model_config = {"from_attributes": True}

    id: int
    email: EmailStr
    is_admin: bool


class Token(BaseModel):
    access_token: str = Field(examples=["example-user-token"])
    token_type: Literal["bearer"] = "bearer"


class LoginRequest(BaseModel):
    email: EmailStr = Field(examples=["user@example.com"])
    password: str = Field(min_length=1, max_length=128, examples=["example-password"])


class PasswordChangeRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128, examples=["example-password"])
    new_password: str = Field(min_length=8, max_length=128, examples=["new-example-password"])
