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
