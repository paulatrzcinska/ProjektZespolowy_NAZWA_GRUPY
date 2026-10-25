from pathlib import Path

import pytest

from app.config import Settings


def test_settings_load_dotenv(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    for key in ("APP_NAME", "DEBUG", "CORS_ORIGINS"):
        monkeypatch.delenv(key, raising=False)
    env_file = tmp_path / ".env"
    env_file.write_text(
        'APP_NAME=local-api\nDEBUG=true\n'
        'CORS_ORIGINS="https://web.example.com, https://mobile.example.com, "\n',
        encoding="utf-8",
    )

    settings = Settings(_env_file=env_file)

    assert settings.app_name == "local-api"
    assert settings.debug is True
    assert settings.cors_origin_list() == [
        "https://web.example.com",
        "https://mobile.example.com",
    ]


def test_environment_overrides_dotenv(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    env_file = tmp_path / ".env"
    env_file.write_text("APP_NAME=dotenv-api\n", encoding="utf-8")
    monkeypatch.setenv("APP_NAME", "environment-api")

    settings = Settings(_env_file=env_file)

    assert settings.app_name == "environment-api"


def test_database_url_is_built_from_parts(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    env_file = tmp_path / ".env"
    env_file.write_text(
        "DB_HOST=db.internal\nDB_PORT=6543\nDB_NAME=shop\n"
        "DB_USER=shop_app\nDB_PASSWORD=p@ss:w/rd#1\n",
        encoding="utf-8",
    )

    url = Settings(_env_file=env_file).database_url()

    assert url.render_as_string(hide_password=False) == (
        "postgresql+asyncpg://shop_app:p%40ss%3Aw%2Frd%231@db.internal:6543/shop"
    )
    assert "p@ss" not in str(url)


def test_database_passwords_have_no_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
    for key in ("DB_PASSWORD", "MIGRATION_DB_PASSWORD"):
        monkeypatch.delenv(key, raising=False)

    settings = Settings(_env_file=None)

    assert settings.db_password is None
    assert settings.database_url().password is None
    # Without a migration password Alembic falls back to the app account.
    assert settings.migration_database_url().username == "shop_app"


def test_migration_url_uses_migration_account(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    env_file = tmp_path / ".env"
    env_file.write_text(
        "DB_PASSWORD=app-secret\nMIGRATION_DB_PASSWORD=migrator-secret\n", encoding="utf-8"
    )

    url = Settings(_env_file=env_file).migration_database_url()

    assert url.username == "shop_migrator"
    assert url.password == "migrator-secret"
