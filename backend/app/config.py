from functools import lru_cache
from pathlib import Path

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "projekt-zespolowy-api"
    debug: bool = False
    api_v1_prefix: str = "/api/v1"
    cors_origins: str = "http://localhost:5173,http://localhost:8081"
    # Passwords have no defaults: they come only from .env or the environment
    # (on AWS injected from Secrets Manager).
    db_host: str = "127.0.0.1"
    db_port: int = 5432
    db_name: str = "shop"
    db_user: str = "shop_app"
    db_password: SecretStr | None = None
    migration_db_user: str = "shop_migrator"
    migration_db_password: SecretStr | None = None
    database_ssl_ca: Path | None = None

    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    def database_url(self) -> URL:
        return self._url(self.db_user, self.db_password)

    def migration_database_url(self) -> URL:
        """Migration account when its password is set, otherwise the app account."""
        if self.migration_db_password is None:
            return self.database_url()
        return self._url(self.migration_db_user, self.migration_db_password)

    def _url(self, user: str, password: SecretStr | None) -> URL:
        # URL.create escapes special characters and masks the password in repr/str.
        return URL.create(
            "postgresql+asyncpg",
            username=user,
            password=password.get_secret_value() if password else None,
            host=self.db_host,
            port=self.db_port,
            database=self.db_name,
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
