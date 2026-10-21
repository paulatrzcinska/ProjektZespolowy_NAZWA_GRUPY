from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class RuntimeSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(".env", ".env.runtime"), extra="ignore")

    app_env: Literal["local", "test", "production"] = "local"
    api_mode: Literal["live", "contract"] = "live"
    jwt_secret: SecretStr | None = None
    jwt_issuer: str = "projekt-zespolowy-api"
    jwt_audience: str = "projekt-zespolowy-clients"
    access_token_minutes: int = Field(default=30, ge=1, le=1440)
    refresh_token_days: int = Field(default=7, ge=1, le=30)
    auth_rate_limit: int = Field(default=10, ge=1, le=10000)
    payments_mock: bool = False
    create_default_admin: bool = False
    default_admin_email: str | None = None
    default_admin_password: SecretStr | None = None

    @model_validator(mode="after")
    def validate_runtime(self) -> "RuntimeSettings":
        if self.api_mode == "live" and (
            self.jwt_secret is None
            or len(self.jwt_secret.get_secret_value().encode()) < 32
        ):
            raise ValueError("Set JWT_SECRET to a random value of at least 32 bytes")
        if self.app_env == "production" and (
            self.api_mode == "contract" or self.payments_mock
        ):
            raise ValueError(
                "Contract preview and simulated payments are restricted to local/test environments"
            )
        if self.create_default_admin:
            if not self.default_admin_email or self.default_admin_password is None:
                raise ValueError(
                    "Admin bootstrap requires DEFAULT_ADMIN_EMAIL and DEFAULT_ADMIN_PASSWORD"
                )
            if len(self.default_admin_password.get_secret_value()) < 8:
                raise ValueError("Admin password must have at least 8 characters")
        return self


@lru_cache
def get_runtime_settings() -> RuntimeSettings:
    return RuntimeSettings()
